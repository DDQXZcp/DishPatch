"""
hardware_node.py — Robot Hardware Simulator

Publishes:  /{namespace}/battery   (std_msgs/Float32)  — battery percentage
            /{namespace}/sensor    (std_msgs/Bool)      — hardware sensor state

Subscribes: /{namespace}/task_command  (std_msgs/String JSON)
              {"command": "sensor_on"}   → set sensor True
              {"command": "sensor_off"}  → set sensor False
"""

import json

import rclpy
from rclpy.node import Node
from std_msgs.msg import Bool, Float32, String

DRAIN_RATE = 0.05   # %/s while discharging
CHARGE_RATE = 0.10  # %/s while charging (battery <= 20%)


class HardwareNode(Node):
    def __init__(self):
        super().__init__("hardware_node")

        # ── parameters ────────────────────────────────────────────────
        self.declare_parameter("robot_namespace", "robot")
        self.declare_parameter("robot_id", "robot")
        self.declare_parameter("initial_battery", 100.0)
        self.declare_parameter("publish_rate", 2.0)  # Hz

        ns = self.get_parameter("robot_namespace").value
        self._battery = self.get_parameter("initial_battery").value
        rate = self.get_parameter("publish_rate").value
        self._dt = 1.0 / rate

        # ── internal state ────────────────────────────────────────────
        self._sensor = False
        self._charging = False

        # ── publishers ────────────────────────────────────────────────
        self._battery_pub = self.create_publisher(Float32, f"/{ns}/battery", 10)
        self._sensor_pub = self.create_publisher(Bool, f"/{ns}/sensor", 10)

        # ── subscribers ───────────────────────────────────────────────
        self._cmd_sub = self.create_subscription(
            String, f"/{ns}/task_command", self._on_command, 10
        )

        # ── timer ─────────────────────────────────────────────────────
        self._timer = self.create_timer(self._dt, self._tick)

        self.get_logger().info(
            f"[{ns}] hardware_node started — battery={self._battery:.1f}%"
        )

    # ── callbacks ─────────────────────────────────────────────────────

    def _on_command(self, msg: String) -> None:
        try:
            data = json.loads(msg.data)
            cmd = data.get("command", "").lower()
        except (json.JSONDecodeError, AttributeError) as exc:
            self.get_logger().warning(f"Bad task_command payload: {exc}")
            return

        if cmd == "sensor_on":
            self._sensor = True
        elif cmd == "sensor_off":
            self._sensor = False
        else:
            self.get_logger().warning(f"Unknown command: '{cmd}'")

    def _tick(self) -> None:
        # Battery: charge when <= 20%, drain otherwise
        if self._battery <= 20.0:
            self._charging = True
        if self._charging:
            self._battery = min(100.0, self._battery + CHARGE_RATE * self._dt)
            if self._battery >= 95.0:
                self._charging = False
        else:
            self._battery = max(0.0, self._battery - DRAIN_RATE * self._dt)

        battery_msg = Float32()
        battery_msg.data = self._battery
        self._battery_pub.publish(battery_msg)

        sensor_msg = Bool()
        sensor_msg.data = self._sensor
        self._sensor_pub.publish(sensor_msg)


def main(args=None):
    rclpy.init(args=args)
    node = HardwareNode()
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()


if __name__ == "__main__":
    main()
