# robot_status

Publishes the robot's current status to rosbridge so the Java backend can consume it.

**Node:** `status_node` (`robot_status/status_node.py`)

## Topics

| Topic | Direction | Message Type | Description |
|---|---|---|---|
| `/{ns}/status` | **publish** | `shared_msgs/RobotStatus` | Full robot status at 10 Hz |
| `/{ns}/battery` | **publish** | `std_msgs/Float32` | Battery percentage at 1 Hz |
| `/{ns}/odom` | **subscribe** | `nav_msgs/Odometry` | Keeps pose and speed in sync from `robot_navigation` |
| `/{ns}/sensor` | **subscribe** | `std_msgs/Bool` | Hardware sensor input (placeholder) |

## Message Types

| Message | Source |
|---|---|
| `shared_msgs/RobotStatus` | `shared_msgs` package (custom) |
| `std_msgs/Float32` | ROS2 standard |
| `std_msgs/Bool` | ROS2 standard |
| `nav_msgs/Odometry` | ROS2 standard |

## Parameters

| Parameter | Default | Description |
|---|---|---|
| `robot_namespace` | `"robot"` | Namespace prefix used in topic names |
| `robot_id` | `"robot"` | Value written into the `robot_id` field of every status message |
| `heartbeat_rate` | `10.0` | Publish rate in Hz |
| `initial_battery` | `100.0` | Starting battery percentage (0–100) |

## Behaviour

`status_node` publishes at a fixed rate (`heartbeat_rate`). On each tick:
- Battery drains at `0.02%/s` (simulated)
- Pose and speed are read from the latest `/odom` message
- Sensor state is read from the latest `/{ns}/sensor` message

Robot state is no longer tracked inside the robot — the backend determines state from the `RobotStatus` data it receives.
