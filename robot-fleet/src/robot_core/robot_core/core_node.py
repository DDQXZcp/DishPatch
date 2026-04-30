"""
core_node.py — Robot Core Node (state machine + battery simulation)

State machine
─────────────
  Waiting ──► Pickup ──► Serving ──► Returning ──► Waiting
                                                      │
                                              battery < 20 %
                                                      ▼
                                               Maintenance

Battery simulation
──────────────────
  • Drains  0.05 %/s while Serving or Pickup
  • Drains  0.02 %/s while Returning
  • Charges 0.10 %/s while Waiting or Maintenance
  • Capped at [0, 100]

Publishes state changes to /{ns}/status_update (std_msgs/String JSON).
Subscribes  /{ns}/task_command            (std_msgs/String JSON)
  {"command": "assign"}   → Waiting → Pickup
  {"command": "pickup"}   → Pickup  → Serving
  {"command": "complete"} → Serving → Returning
  {"command": "reset"}    → any     → Waiting
"""

import json
import random

import rclpy
from rclpy.node import Node
from std_msgs.msg import String


# ── State constants ────────────────────────────────────────────────────────────
WAITING = "Waiting"
PICKUP = "Pickup"
SERVING = "Serving"
RETURNING = "Returning"
MAINTENANCE = "Maintenance"

VALID_TRANSITIONS = {
    WAITING:     [PICKUP],
    PICKUP:      [SERVING],
    SERVING:     [RETURNING],
    RETURNING:   [WAITING],
    MAINTENANCE: [WAITING],
}

COMMAND_MAP = {
    "assign":   (WAITING,   PICKUP),
    "pickup":   (PICKUP,    SERVING),
    "complete": (SERVING,   RETURNING),
    "reset":    (None,      WAITING),    # None = from any state
}

DRAIN_RATES = {
    SERVING:  0.05,
    PICKUP:   0.05,
    RETURNING: 0.02,
    WAITING:  -0.10,    # negative = charging
    MAINTENANCE: -0.10,
}

LOW_BATTERY_THRESHOLD = 20.0
BATTERY_TICK_HZ = 2.0  # battery update frequency


class CoreNode(Node):
    def __init__(self):
        super().__init__("core_node")

        # ── parameters ────────────────────────────────────────────────
        self.declare_parameter("robot_namespace", "robot")
        self.declare_parameter("robot_id", "robot")
        self.declare_parameter("initial_battery", 100.0)
        self.declare_parameter("auto_cycle", True)   # demo: auto-advance states

        ns = self.get_parameter("robot_namespace").value
        self._robot_id = self.get_parameter("robot_id").value
        initial_battery = self.get_parameter("initial_battery").value
        self._auto_cycle = self.get_parameter("auto_cycle").value

        # ── state ─────────────────────────────────────────────────────
        self._state = WAITING
        self._battery = float(initial_battery)
        self._state_elapsed = 0.0   # seconds in current state

        # Randomise auto-cycle dwell times to make robots look independent
        self._dwell = {
            PICKUP:    random.uniform(5.0, 10.0),
            SERVING:   random.uniform(10.0, 20.0),
            RETURNING: random.uniform(5.0, 12.0),
            WAITING:   random.uniform(3.0, 8.0),
        }

        # ── publishers / subscribers ──────────────────────────────────
        self._update_pub = self.create_publisher(
            String, f"/{ns}/status_update", 10
        )
        self._cmd_sub = self.create_subscription(
            String, f"/{ns}/task_command", self._on_command, 10
        )

        # Battery timer
        self._battery_timer = self.create_timer(
            1.0 / BATTERY_TICK_HZ, self._update_battery
        )
        # State-machine / auto-cycle timer (1 Hz)
        self._sm_timer = self.create_timer(1.0, self._tick_state_machine)

        # Publish initial state
        self._publish_update()
        self.get_logger().info(
            f"[{ns}] core_node started — robot_id={self._robot_id}, "
            f"auto_cycle={self._auto_cycle}"
        )

    # ── internal helpers ──────────────────────────────────────────────

    def _publish_update(self) -> None:
        payload = json.dumps({"state": self._state, "battery": round(self._battery, 2)})
        msg = String()
        msg.data = payload
        self._update_pub.publish(msg)
        self.get_logger().info(
            f"state={self._state:12s}  battery={self._battery:.1f}%"
        )

    def _transition(self, new_state: str) -> None:
        self.get_logger().info(
            f"Transition: {self._state} → {new_state}"
        )
        self._state = new_state
        self._state_elapsed = 0.0
        self._publish_update()

    # ── timer callbacks ───────────────────────────────────────────────

    def _update_battery(self) -> None:
        dt = 1.0 / BATTERY_TICK_HZ
        drain = DRAIN_RATES.get(self._state, 0.0)
        self._battery -= drain * dt
        self._battery = max(0.0, min(100.0, self._battery))

        # Low battery → force Maintenance
        if self._battery < LOW_BATTERY_THRESHOLD and self._state not in (
            MAINTENANCE, WAITING
        ):
            self.get_logger().warning(
                f"Battery low ({self._battery:.1f}%) → entering Maintenance"
            )
            self._transition(MAINTENANCE)

        # Fully charged while in Maintenance → return to Waiting
        if self._state == MAINTENANCE and self._battery >= 95.0:
            self._transition(WAITING)

    def _tick_state_machine(self) -> None:
        if not self._auto_cycle:
            return

        self._state_elapsed += 1.0
        dwell = self._dwell.get(self._state, 10.0)

        if self._state_elapsed >= dwell:
            if self._state == WAITING:
                self._transition(PICKUP)
            elif self._state == PICKUP:
                self._transition(SERVING)
            elif self._state == SERVING:
                self._transition(RETURNING)
            elif self._state == RETURNING:
                self._transition(WAITING)
            # MAINTENANCE exits via battery logic above

    # ── command handler ───────────────────────────────────────────────

    def _on_command(self, msg: String) -> None:
        try:
            data = json.loads(msg.data)
            cmd = data.get("command", "").lower()
        except (json.JSONDecodeError, AttributeError) as exc:
            self.get_logger().warning(f"Bad task_command payload: {exc}")
            return

        if cmd not in COMMAND_MAP:
            self.get_logger().warning(f"Unknown command: '{cmd}'")
            return

        required_from, next_state = COMMAND_MAP[cmd]
        if required_from is not None and self._state != required_from:
            self.get_logger().warning(
                f"Command '{cmd}' invalid in state '{self._state}' "
                f"(requires '{required_from}')"
            )
            return

        self._transition(next_state)


def main(args=None):
    rclpy.init(args=args)
    node = CoreNode()
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()


if __name__ == "__main__":
    main()
