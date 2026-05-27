# robot_location_publisher

> **Legacy package** — superseded by `robot_navigation`.
> Kept for reference. Do not use in new deployments.

Original proof-of-concept node that published a simulated circular position
on a single hardcoded topic with no namespace support.

**Node:** `location_publisher` (`robot_location_publisher/location_publisher.py`)

## Topics

| Topic | Direction | Message Type | Description |
|---|---|---|---|
| `/robot/location` | **publish** | `geometry_msgs/PoseStamped` | Hardcoded circular position, no namespace |

## Message Types

| Message | Source |
|---|---|
| `geometry_msgs/PoseStamped` | ROS2 standard |

## Why it was replaced

- Topic name `/robot/location` is hardcoded — cannot support multiple robots
- Uses `PoseStamped` instead of the richer `Odometry` message
- No `cmd_vel` subscription — robot cannot be controlled
- No integration with `robot_core` state machine or `robot_status`
