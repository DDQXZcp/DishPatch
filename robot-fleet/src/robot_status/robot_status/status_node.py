"""
status_node.py — Robot Status Node

Publishes:  /{namespace}/status    (shared_msgs/RobotStatus)
            /{namespace}/battery   (std_msgs/Float32)

Subscribes: /{namespace}/odom      (nav_msgs/Odometry)   — pose + speed
            /{namespace}/sensor    (std_msgs/Bool)        — hardware sensor input

Simulates battery drain at 0.02%/s. Robot state is determined by the backend.
"""

import rclpy
from rclpy.node import Node
from nav_msgs.msg import Odometry
from std_msgs.msg import Bool, Float32
from shared_msgs.msg import RobotStatus


class StatusNode(Node):
    def __init__(self):
        super().__init__("status_node")

        # ── parameters ────────────────────────────────────────────────
        self.declare_parameter("robot_namespace", "robot")
        self.declare_parameter("robot_id", "robot")
        self.declare_parameter("heartbeat_rate", 1.0)
        self.declare_parameter("initial_battery", 100.0)

        ns = self.get_parameter("robot_namespace").value
        self._robot_id = self.get_parameter("robot_id").value
        rate = self.get_parameter("heartbeat_rate").value
        self._battery = self.get_parameter("initial_battery").value

        # ── internal state ────────────────────────────────────────────
        self._speed = 0.0
        self._sensor = False
        self._pose_x = 0.0
        self._pose_y = 0.0
        self._pose_z = 0.0
        self._orient_z = 0.0
        self._orient_w = 1.0

        # ── publishers ────────────────────────────────────────────────
        self._status_pub = self.create_publisher(RobotStatus, f"/{ns}/status", 10)
        self._battery_pub = self.create_publisher(Float32, f"/{ns}/battery", 10)

        # ── subscribers ───────────────────────────────────────────────
        self._odom_sub = self.create_subscription(
            Odometry, f"/{ns}/odom", self._on_odom, 10
        )
        self._sensor_sub = self.create_subscription(
            Bool, f"/{ns}/sensor", self._on_sensor, 10
        )

        # ── timer ─────────────────────────────────────────────────────
        self._dt = 1.0 / rate
        self._timer = self.create_timer(self._dt, self._publish_status)

        self.get_logger().info(
            f"[{ns}] status_node started — publishing /{ns}/status"
        )

    # ── callbacks ─────────────────────────────────────────────────────

    def _on_odom(self, msg: Odometry) -> None:
        p = msg.pose.pose
        self._pose_x = p.position.x
        self._pose_y = p.position.y
        self._pose_z = p.position.z
        self._orient_z = p.orientation.z
        self._orient_w = p.orientation.w
        self._speed = msg.twist.twist.linear.x

    def _on_sensor(self, msg: Bool) -> None:
        self._sensor = msg.data

    def _publish_status(self) -> None:
        # Battery drain simulation: 0.02%/s
        self._battery = max(0.0, min(100.0, self._battery - 0.02 * self._dt))

        status = RobotStatus()
        status.robot_id = self._robot_id
        status.battery = self._battery
        status.speed = self._speed
        status.sensor = self._sensor
        status.pose.position.x = self._pose_x
        status.pose.position.y = self._pose_y
        status.pose.position.z = self._pose_z
        status.pose.orientation.z = self._orient_z
        status.pose.orientation.w = self._orient_w
        self._status_pub.publish(status)

        battery_msg = Float32()
        battery_msg.data = self._battery
        self._battery_pub.publish(battery_msg)


def main(args=None):
    rclpy.init(args=args)
    node = StatusNode()
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()


if __name__ == "__main__":
    main()
