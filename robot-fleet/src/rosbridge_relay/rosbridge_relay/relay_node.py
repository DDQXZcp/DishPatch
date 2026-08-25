"""
relay_node.py — rosbridge Relay Node

Carries one robot's topics to a rosbridge server that is not on this ROS graph,
so a robot running somewhere else (a laptop, WSL) can join a fleet without any
DDS traffic crossing the network.

Uplink   (local graph → rosbridge):
    /{ns}/status                             shared_msgs/RobotStatus
    /{ns}/navigate_to_pose/_action/status    action_msgs/GoalStatusArray

Downlink (rosbridge → local graph):
    /{ns}/goal_pose                          geometry_msgs/PoseStamped

These three are what the control backend reads and writes; everything else —
tf, odom, costmaps, the NavigateToPose action itself — stays local, next to the
Nav2 stack that needs it.

The connection is outbound only, so the robot can sit behind NAT. It is also
unauthenticated, exactly like the backend's own link: whoever can reach the
rosbridge port can drive the fleet.

Parameters:
    rosbridge_url    — ws://host:9090 of the rosbridge server to join
    robot_namespace  — this robot's namespace, e.g. "robot3"
"""

import json
import threading
import time

import rclpy
import websocket
from action_msgs.msg import GoalStatusArray
from geometry_msgs.msg import PoseStamped
from rclpy.node import Node
from rosidl_runtime_py.convert import message_to_ordereddict
from rosidl_runtime_py.set_message import set_message_fields
from shared_msgs.msg import RobotStatus

# Topic suffix, message class, and the type name rosbridge knows it by.
UPLINK = (
    ("status", RobotStatus, "shared_msgs/msg/RobotStatus"),
    ("navigate_to_pose/_action/status", GoalStatusArray, "action_msgs/msg/GoalStatusArray"),
)

DOWNLINK = (
    ("goal_pose", PoseStamped, "geometry_msgs/PoseStamped"),
)

RECONNECT_DELAY_S = 5.0

# Long enough not to spin on an idle link, short enough that shutdown is not
# noticeably delayed. Goals arrive rarely, so timing out is the normal case.
RECEIVE_TIMEOUT_S = 10.0


class RelayNode(Node):
    def __init__(self):
        super().__init__("rosbridge_relay_node")

        # ── parameters ────────────────────────────────────────────────
        self.declare_parameter("rosbridge_url", "ws://localhost:9090")
        self.declare_parameter("robot_namespace", "robot")

        self._url = self.get_parameter("rosbridge_url").value
        self._ns = self.get_parameter("robot_namespace").value

        # ── connection ────────────────────────────────────────────────
        # None whenever the link is down. Guarded by the lock, which is also
        # held while sending: a WebSocket takes one write at a time.
        self._connection = None
        self._lock = threading.Lock()

        # Last payload per uplink topic, replayed on reconnect. The action
        # status topic is transient_local on the local graph, so a subscriber
        # that joins late is handed the current state; relaying it as an
        # ordinary rosbridge topic loses that, and a terminal status produced
        # while the link is down would otherwise never be republished.
        self._last_uplink = {}

        # ── downlink: remote publishes we republish locally ────────────
        self._downlink = {}

        for suffix, message_type, _ in DOWNLINK:
            topic = f"/{self._ns}/{suffix}"
            self._downlink[topic] = (
                self.create_publisher(message_type, topic, 10),
                message_type,
            )

        # ── uplink: local topics we forward to rosbridge ───────────────
        # Default QoS on purpose: a volatile subscription still matches the
        # action server's transient-local status publisher.
        for suffix, message_type, _ in UPLINK:
            topic = f"/{self._ns}/{suffix}"
            self.create_subscription(
                message_type,
                topic,
                lambda message, topic=topic: self._forward(topic, message),
                10,
            )

        self.get_logger().info(
            f"[{self._ns}] rosbridge_relay_node started — relaying to {self._url}"
        )

        threading.Thread(target=self._run_link, daemon=True).start()

    # ── link ──────────────────────────────────────────────────────────

    def _run_link(self) -> None:
        """Keeps a rosbridge connection up, rebuilding it whenever it drops."""
        while rclpy.ok():
            try:
                connection = websocket.create_connection(
                    self._url, timeout=RECEIVE_TIMEOUT_S
                )
            except Exception as error:
                self.get_logger().warning(
                    f"Cannot reach rosbridge at {self._url} ({error}) — "
                    f"retrying in {RECONNECT_DELAY_S:.0f}s"
                )
                time.sleep(RECONNECT_DELAY_S)
                continue

            self.get_logger().info(f"Connected to rosbridge at {self._url}")

            try:
                # Declared before anything else can use the connection, so no
                # publish can go out on a topic rosbridge has not been told about.
                self._declare_topics(connection)

                with self._lock:
                    self._connection = connection

                self._receive_until_closed(connection)

            except Exception as error:
                self.get_logger().warning(f"rosbridge link lost: {error}")

            finally:
                with self._lock:
                    self._connection = None
                try:
                    connection.close()
                except Exception:
                    pass

            time.sleep(RECONNECT_DELAY_S)

    def _declare_topics(self, connection) -> None:
        """Advertises what this robot publishes and subscribes to what it needs."""
        for suffix, _, type_name in UPLINK:
            connection.send(json.dumps({
                "op": "advertise",
                "topic": f"/{self._ns}/{suffix}",
                "type": type_name,
            }))

        for suffix, _, type_name in DOWNLINK:
            connection.send(json.dumps({
                "op": "subscribe",
                "topic": f"/{self._ns}/{suffix}",
                "type": type_name,
            }))

        # The uplink carries state, not only samples: a goal transition that
        # happened while the link was down has no later message to correct it,
        # because Nav2 only publishes when a goal changes. Replaying the last
        # value restores what transient_local gives a subscriber locally.
        #
        # Snapshotted — _forward writes this from the executor thread.
        for payload in list(self._last_uplink.values()):
            connection.send(payload)

    def _receive_until_closed(self, connection) -> None:
        while rclpy.ok():
            try:
                payload = connection.recv()
            except websocket.WebSocketTimeoutException:
                continue  # an idle link, not a broken one

            if not payload:
                raise ConnectionError("rosbridge closed the connection")

            self._handle(payload)

    # ── message plumbing ──────────────────────────────────────────────

    def _handle(self, payload: str) -> None:
        """Republishes one rosbridge message on the local graph."""
        try:
            message = json.loads(payload)
        except ValueError as error:
            self.get_logger().warning(f"Unreadable rosbridge message: {error}")
            return

        if message.get("op") != "publish":
            return

        entry = self._downlink.get(message.get("topic"))

        if entry is None:
            return

        publisher, message_type = entry
        ros_message = message_type()

        try:
            set_message_fields(ros_message, message.get("msg", {}))
        except Exception as error:
            self.get_logger().warning(
                f"Dropping malformed {message.get('topic')}: {error}"
            )
            return

        publisher.publish(ros_message)

    def _forward(self, topic: str, message) -> None:
        """Sends one local message up to rosbridge, if the link is up."""
        payload = json.dumps({
            "op": "publish",
            "topic": topic,
            "msg": message_to_ordereddict(message),
        })

        # Before the lock, and before the early return: the message that matters
        # is the one that arrives while the link is down.
        self._last_uplink[topic] = payload

        with self._lock:
            if self._connection is None:
                # Dropped rather than queued — a backlog of stale samples is
                # not worth delivering. The cache above is what carries the
                # current value across the gap.
                return

            try:
                self._connection.send(payload)
            except Exception as error:
                self.get_logger().warning(f"Failed to relay {topic}: {error}")
                self._connection = None  # the link thread rebuilds it


def main(args=None):
    rclpy.init(args=args)
    node = RelayNode()
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()


if __name__ == "__main__":
    main()
