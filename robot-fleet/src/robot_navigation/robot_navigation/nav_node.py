"""
nav_node.py — Robot Navigation Node

Publishes:  /{namespace}/odom    (nav_msgs/Odometry)  @ 10 Hz
Subscribes: /{namespace}/cmd_vel (geometry_msgs/Twist)

Simulates a robot moving in a circle at a configurable radius/speed.
When a /cmd_vel command is received the linear.x and angular.z values
are applied to the internal velocity state so the trajectory changes.
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
        self.declare_parameter("publish_rate", 10.0)    # Hz
        self.declare_parameter("initial_radius", 2.0)   # metres

        ns = self.get_parameter("robot_namespace").value
        rate = self.get_parameter("publish_rate").value
        radius = self.get_parameter("initial_radius").value

        # ── state ─────────────────────────────────────────────────────
        self.x: float = radius
        self.y: float = 0.0
        self.theta: float = 0.0
        self.linear_x: float = 0.5     # m/s — default forward speed
        self.angular_z: float = 0.25   # rad/s — default rotation

        # ── publishers / subscribers / TF ─────────────────────────────
        self.odom_pub = self.create_publisher(
            Odometry, f"/{ns}/odom", 10
        )
        self.cmd_sub = self.create_subscription(
            Twist, f"/{ns}/cmd_vel", self.cmd_vel_callback, 10
        )
        self.tf_broadcaster = TransformBroadcaster(self)

        self.timer = self.create_timer(1.0 / rate, self.publish_odom)
        self.get_logger().info(
            f"[{ns}] nav_node started — odom → /{ns}/odom"
        )

    # ── callbacks ─────────────────────────────────────────────────────

    def cmd_vel_callback(self, msg: Twist) -> None:
        self.linear_x = msg.linear.x
        self.angular_z = msg.angular.z
        self.get_logger().debug(
            f"cmd_vel received: linear={self.linear_x:.2f} angular={self.angular_z:.2f}"
        )

    def publish_odom(self) -> None:
        dt = 0.1  # seconds per tick (matches 10 Hz default)

        # Integrate simple unicycle model
        self.theta += self.angular_z * dt
        self.x += self.linear_x * math.cos(self.theta) * dt
        self.y += self.linear_x * math.sin(self.theta) * dt

        now = self.get_clock().now().to_msg()

        # ── Odometry message ──────────────────────────────────────────
        odom = Odometry()
        odom.header.stamp = now
        odom.header.frame_id = "odom"
        odom.child_frame_id = "base_link"

        odom.pose.pose.position.x = self.x
        odom.pose.pose.position.y = self.y
        odom.pose.pose.position.z = 0.0
        odom.pose.pose.orientation.z = math.sin(self.theta / 2.0)
        odom.pose.pose.orientation.w = math.cos(self.theta / 2.0)

        odom.twist.twist.linear.x = self.linear_x
        odom.twist.twist.angular.z = self.angular_z

        self.odom_pub.publish(odom)

        # ── TF broadcast odom → base_link ────────────────────────────
        tf = TransformStamped()
        tf.header.stamp = now
        tf.header.frame_id = "odom"
        tf.child_frame_id = "base_link"
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
