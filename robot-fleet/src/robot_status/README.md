# robot_status

Publishes the robot's current status to rosbridge so the Java backend can consume it.

**Node:** `status_node` (`robot_status/status_node.py`)

## Topics

| Topic | Direction | Message Type | Description |
|---|---|---|---|
| `/{ns}/status` | **publish** | `shared_msgs/RobotStatus` | Full robot status at 1 Hz heartbeat and on every state change |
| `/{ns}/status_update` | **subscribe** | `std_msgs/String` (JSON) | State change events from `robot_core` |
| `/{ns}/odom` | **subscribe** | `nav_msgs/Odometry` | Keeps pose fields in sync from `robot_navigation` |

## Message Types

| Message | Source |
|---|---|
| `shared_msgs/RobotStatus` | `shared_msgs` package (custom) |
| `std_msgs/String` | ROS2 standard |
| `nav_msgs/Odometry` | ROS2 standard |

## Parameters

| Parameter | Default | Description |
|---|---|---|
| `robot_namespace` | `"robot"` | Namespace prefix used in topic names |
| `robot_id` | `"robot"` | Value written into the `robot_id` field of every status message |
| `heartbeat_rate` | `1.0` | Background publish rate in Hz even when state has not changed |

## Event-Driven Behaviour

`status_update` carries a JSON payload from `robot_core`:

```json
{"state": "Serving", "battery": 85.5}
```

On receipt, `status_node` immediately publishes a fresh `RobotStatus` message in
addition to the regular 1 Hz heartbeat, so the backend sees state transitions
with minimal latency.
