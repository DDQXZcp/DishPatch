"""
nav_node.py — Robot Navigation Node (Nav2 fake driver)

Publishes:  /{namespace}/odom    (nav_msgs/Odometry)  @ 10 Hz
            TF: {ns}/odom → {ns}/base_link

Subscribes: /{namespace}/cmd_vel (geometry_msgs/Twist)

Integrates cmd_vel into odometry. Velocity starts at 0 — controlled by Nav2.
"""

import math

import rclpy
from rclpy.node import Node
from nav_msgs.msg import Odometry
from geometry_msgs.msg import Twist, TransformStamped
from tf2_ros import TransformBroadcaster


class NavNode(Node):
    def __init__(self):
        super().__init__("nav_node")

        # ── parameters ────────────────────────────────────────────────
        self.declare_parameter("robot_namespace", "robot")
        self.declare_parameter("publish_rate", 10.0)  # Hz

        ns = self.get_parameter("robot_namespace").value
        rate = self.get_parameter("publish_rate").value
        self._ns = ns
        self._dt = 1.0 / rate

        # ── state ─────────────────────────────────────────────────────
        self.x: float = 0.0
        self.y: float = 0.0
        self.theta: float = 0.0
        self.linear_x: float = 0.0
        self.angular_z: float = 0.0

        # ── publishers / subscribers / TF ─────────────────────────────
        self.odom_pub = self.create_publisher(Odometry, f"/{ns}/odom", 10)
        self.cmd_sub = self.create_subscription(
            Twist, f"/{ns}/cmd_vel", self.cmd_vel_callback, 10
        )
        self.tf_broadcaster = TransformBroadcaster(self)

        self.timer = self.create_timer(self._dt, self.publish_odom)
        self.get_logger().info(
            f"nav_node started — odom → /{ns}/odom (Nav2 fake driver)"
        )

    # ── callbacks ─────────────────────────────────────────────────────

    def cmd_vel_callback(self, msg: Twist) -> None:
        self.linear_x = msg.linear.x
        self.angular_z = msg.angular.z

    def publish_odom(self) -> None:
        ns = self._ns

        # Integrate unicycle model
        self.theta += self.angular_z * self._dt
        self.x += self.linear_x * math.cos(self.theta) * self._dt
        self.y += self.linear_x * math.sin(self.theta) * self._dt

        now = self.get_clock().now().to_msg()

        # ── Odometry message ──────────────────────────────────────────
        odom = Odometry()
        odom.header.stamp = now
        odom.header.frame_id = f"{ns}/odom"
        odom.child_frame_id = f"{ns}/base_link"
        odom.pose.pose.position.x = self.x
        odom.pose.pose.position.y = self.y
        odom.pose.pose.position.z = 0.0
        odom.pose.pose.orientation.z = math.sin(self.theta / 2.0)
        odom.pose.pose.orientation.w = math.cos(self.theta / 2.0)
        odom.twist.twist.linear.x = self.linear_x
        odom.twist.twist.angular.z = self.angular_z
        self.odom_pub.publish(odom)

        # ── TF: {ns}/odom → {ns}/base_link ───────────────────────────
        tf = TransformStamped()
        tf.header.stamp = now
        tf.header.frame_id = f"{ns}/odom"
        tf.child_frame_id = f"{ns}/base_link"
        tf.transform.translation.x = self.x
        tf.transform.translation.y = self.y
        tf.transform.translation.z = 0.0
        tf.transform.rotation.z = math.sin(self.theta / 2.0)
        tf.transform.rotation.w = math.cos(self.theta / 2.0)
        self.tf_broadcaster.sendTransform(tf)


def main(args=None):
    rclpy.init(args=args)
    node = NavNode()
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()


if __name__ == "__main__":
    main()
