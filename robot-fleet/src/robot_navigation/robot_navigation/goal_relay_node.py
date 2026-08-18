"""
goal_relay_node.py — Goal Relay Node

NOT LAUNCHED, AND SHOULD NOT BE. Nav2's bt_navigator already subscribes to the
relative topic "goal_pose", which under a robot namespace resolves to exactly the
topic below, and forwards it to its own NavigateToPose action. Running this node
as well put two subscribers on one topic, so every goal became two action goals a
few milliseconds apart and the second preempted and aborted the first. That was
true of every goal this fleet ever ran.

Kept only as a record of the interface. Removed from robot_launch.py — see the
note there before reinstating it.

Subscribes: /{namespace}/goal_pose  (geometry_msgs/PoseStamped)  — from backend
Action:     /{namespace}/navigate_to_pose  (nav2_msgs/NavigateToPose)  — to bt_navigator
"""

import rclpy
from rclpy.node import Node
from rclpy.action import ActionClient
from geometry_msgs.msg import PoseStamped
from nav2_msgs.action import NavigateToPose


class GoalRelayNode(Node):
    def __init__(self):
        super().__init__("goal_relay_node")

        self.declare_parameter("robot_namespace", "robot")
        ns = self.get_parameter("robot_namespace").value
        self._ns = ns

        self._action_client = ActionClient(
            self, NavigateToPose, f"/{ns}/navigate_to_pose"
        )

        self._goal_sub = self.create_subscription(
            PoseStamped, f"/{ns}/goal_pose", self._on_goal_pose, 10
        )

        self.get_logger().info(
            f"[{ns}] goal_relay_node started — subscribing /{ns}/goal_pose"
        )

    def _on_goal_pose(self, msg: PoseStamped) -> None:
        if msg.header.frame_id == "":
            msg.header.frame_id = "map"

        x = msg.pose.position.x
        y = msg.pose.position.y
        frame = msg.header.frame_id
        self.get_logger().info(f"Relaying goal → x={x:.2f} y={y:.2f} frame={frame}")

        if not self._action_client.wait_for_server(timeout_sec=1.0):
            self.get_logger().warning("NavigateToPose action server not available, dropping goal")
            return

        goal = NavigateToPose.Goal()
        goal.pose = msg
        self._action_client.send_goal_async(goal)


def main(args=None):
    rclpy.init(args=args)
    node = GoalRelayNode()
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()


if __name__ == "__main__":
    main()
