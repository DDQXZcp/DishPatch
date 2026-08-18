# ROS2 Workspace — `robot-fleet/src/`

Every package here is built with `colcon` into one workspace. Which of them run
depends on the container: the robot image launches `robot_bringup`, the Nav2
image launches `nav2_launcher`, and a robot joining from outside the fleet also
runs `rosbridge_relay`.

For the architecture these packages implement, see
[../README.md](../README.md).

## Packages

| Package | Type | Entry point | Role |
|---|---|---|---|
| [`shared_msgs`](./shared_msgs/) | CMake | — | Message definitions shared across the fleet |
| [`robot_hardware`](./robot_hardware/) | Python | `hardware_node` | Battery drain and sensor simulation |
| [`robot_navigation`](./robot_navigation/) | Python | `nav_node` | Fake driver — integrates `cmd_vel` into odometry and TF |
| [`robot_status`](./robot_status/) | Python | `status_node` | Aggregates telemetry into `/{ns}/status` |
| [`robot_bringup`](./robot_bringup/) | Python | `launch/robot_launch.py` | Launches one robot's nodes |
| [`nav2_launcher`](./nav2_launcher/) | Python | `launch/multi_nav2_launch.py` | Launches the Nav2 stack for a list of namespaces |
| [`rosbridge_relay`](./rosbridge_relay/) | Python | `relay_node` | Joins a robot running off the fleet's ROS graph, over the rosbridge WebSocket |
| [`robot_location_publisher`](./robot_location_publisher/) | Python | `location_publisher` | Legacy, superseded by `robot_navigation` |

`robot_navigation` also ships `goal_relay_node`, which is **not launched** —
`bt_navigator` already subscribes to `goal_pose`, and running both put two
subscribers on the topic so every goal was executed twice. See
[../README.md](../README.md) before re-adding it anywhere.

## Nodes per robot

The robot container runs four nodes, launched together by `robot_bringup`:

| Node | Package |
|---|---|
| `/{ns}/hardware_node` | `robot_hardware` |
| `/{ns}/nav_node` | `robot_navigation` |
| `/{ns}/status_node` | `robot_status` |
| `/{ns}/map_to_odom_tf` | `tf2_ros` (static transform publisher) |

The five Nav2 nodes — `map_server`, `planner_server`, `controller_server`,
`bt_navigator`, `lifecycle_manager` — run in the separate `nav2` container, once
per namespace.

How `setup.py` maps a node name to a file:

```python
# robot_hardware/setup.py
entry_points={
    "console_scripts": [
        "hardware_node = robot_hardware.hardware_node:main",
    ],
}
```

## Topics per robot

| Topic | Type | Publisher | Subscriber |
|---|---|---|---|
| `/{ns}/goal_pose` | `geometry_msgs/PoseStamped` | backend | `bt_navigator` |
| `/{ns}/status` | `shared_msgs/RobotStatus` | `status_node` | backend, via rosbridge |
| `/{ns}/task_command` | `std_msgs/String` (JSON) | backend | `hardware_node` |
| `/{ns}/battery` | `std_msgs/Float32` | `hardware_node` | `status_node` |
| `/{ns}/sensor` | `std_msgs/Bool` | `hardware_node` | `status_node` |
| `/{ns}/odom` | `nav_msgs/Odometry` | `nav_node` | `status_node`, `controller_server` |
| `/{ns}/cmd_vel` | `geometry_msgs/Twist` | `controller_server` | `nav_node` |

Plus `/map` from `map_server`, and `/{ns}/navigate_to_pose/_action/status` from
`bt_navigator`, which the backend reads to tell a driving robot from a stranded
one.

## Message types

**Custom**, defined in `shared_msgs`:

- `shared_msgs/RobotStatus` — `robot_id`, `battery`, `speed`, `sensor`, `pose`
- `shared_msgs/TaskStatus`

**Standard:** `nav_msgs/Odometry`, `nav_msgs/OccupancyGrid`,
`geometry_msgs/Twist`, `geometry_msgs/Pose`, `geometry_msgs/PoseStamped`,
`std_msgs/String`, `std_msgs/Float32`, `std_msgs/Bool`,
`action_msgs/GoalStatusArray`.

## Build order

`shared_msgs` must be built first — the Python packages import its generated
message interfaces, which do not exist until it is built. The Dockerfiles handle
this with two colcon passes:

```bash
source /opt/ros/jazzy/setup.bash
colcon build --packages-select shared_msgs
source install/setup.bash
colcon build --packages-skip shared_msgs
```

## Running one robot locally

```bash
source /opt/ros/jazzy/setup.bash
source install/setup.bash
ros2 launch robot_bringup robot_launch.py namespace:=robot1
```

Nav2 is not part of this, so the robot will publish status and hold still. To
plan and drive it needs the `nav2` container, or the all-in-one `robot3` image
described in [../ROBOT3_GUIDE.md](../ROBOT3_GUIDE.md).
