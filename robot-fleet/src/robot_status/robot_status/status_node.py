"""
status_node.py — Robot Status Node

Publishes:  /{namespace}/status  (shared_msgs/RobotStatus)

The node is event-driven: it listens on an internal ROS topic
  /{namespace}/status_update  (std_msgs/String, JSON payload)
and re-broadcasts the full RobotStatus whenever state changes.

It also publishes at a slow background rate (1 Hz) so the Java backend
always receives a heartbeat even when nothing changes.

Expected JSON payload on /{namespace}/status_update:
  {"state": "Serving", "battery": 85.5}
"""

import json

import rclpy
from rclpy.node import Node
from std_msgs.msg import String
from shared_msgs.msg import RobotStatus


class StatusNode(Node):
    def __init__(self):
        super().__init__("status_node")

        # ── parameters ────────────────────────────────────────────────
        self.declare_parameter("robot_namespace", "robot")
        self.declare_parameter("robot_id", "robot")
        self.declare_parameter("heartbeat_rate", 1.0)  # Hz

        ns = self.get_parameter("robot_namespace").value
        self._robot_id = self.get_parameter("robot_id").value
        rate = self.get_parameter("heartbeat_rate").value

        # ── internal state ────────────────────────────────────────────
        self._state = "Waiting"
        self._battery = 100.0
        self._pose_x = 0.0
        self._pose_y = 0.0
        self._pose_z = 0.0
        self._orient_z = 0.0
        self._orient_w = 1.0

        # ── publishers / subscribers ──────────────────────────────────
        self._status_pub = self.create_publisher(
            RobotStatus, f"/{ns}/status", 10
        )

        # Internal event topic — core_node posts state change JSON here
        self._update_sub = self.create_subscription(
            String,
            f"/{ns}/status_update",
            self._on_status_update,
            10,
        )

        # Odom subscriber to keep pose in sync
        from nav_msgs.msg import Odometry  # local import — avoids circular at module level
        self._odom_sub = self.create_subscription(
            Odometry, f"/{ns}/odom", self._on_odom, 10
        )

        # Heartbeat timer
        self._timer = self.create_timer(1.0 / rate, self._publish_status)

        self.get_logger().info(
            f"[{ns}] status_node started — publishing /{ns}/status"
        )

    # ── callbacks ─────────────────────────────────────────────────────

    def _on_status_update(self, msg: String) -> None:
        """Called when core_node sends a state-change event."""
        try:
            data = json.loads(msg.data)
            if "state" in data:
                self._state = data["state"]
            if "battery" in data:
                self._battery = float(data["battery"])
            self.get_logger().info(
                f"Status update → state={self._state} battery={self._battery:.1f}%"
            )
            # Publish immediately on event
            self._publish_status()
        except (json.JSONDecodeError, KeyError, ValueError) as exc:
            self.get_logger().warning(f"Bad status_update payload: {exc}")

    def _on_odom(self, msg) -> None:
        p = msg.pose.pose
        self._pose_x = p.position.x
        self._pose_y = p.position.y
        self._pose_z = p.position.z
        self._orient_z = p.orientation.z
        self._orient_w = p.orientation.w

    def _publish_status(self) -> None:
        status = RobotStatus()
        status.robot_id = self._robot_id
        status.state = self._state
        status.battery = self._battery
        status.pose.position.x = self._pose_x
        status.pose.position.y = self._pose_y
        status.pose.position.z = self._pose_z
        status.pose.orientation.z = self._orient_z
        status.pose.orientation.w = self._orient_w
        self._status_pub.publish(status)


def main(args=None):
    rclpy.init(args=args)
    node = StatusNode()
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()


if __name__ == "__main__":
    main()
