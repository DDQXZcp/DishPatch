import math

import rclpy
from rclpy.node import Node
from geometry_msgs.msg import PoseStamped


class LocationPublisher(Node):
    def __init__(self):
        super().__init__("location_publisher")

        self.publisher = self.create_publisher(
            PoseStamped,
            "/robot/location",
            10
        )

        self.timer = self.create_timer(1.0, self.publish_location)
        self.t = 0.0

    def publish_location(self):
        msg = PoseStamped()

        msg.header.stamp = self.get_clock().now().to_msg()
        msg.header.frame_id = "map"

        # Simulated circular movement
        x = math.cos(self.t)
        y = math.sin(self.t)
        theta = self.t

        msg.pose.position.x = x
        msg.pose.position.y = y
        msg.pose.position.z = 0.0

        msg.pose.orientation.z = math.sin(theta / 2.0)
        msg.pose.orientation.w = math.cos(theta / 2.0)

        self.publisher.publish(msg)

        self.get_logger().info(
            f"Published location: x={x:.2f}, y={y:.2f}, theta={theta:.2f}"
        )

        self.t += 0.1


def main(args=None):
    rclpy.init(args=args)
    node = LocationPublisher()
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()


if __name__ == "__main__":
    main()
