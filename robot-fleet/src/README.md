# ROS2 Workspace — `robot-fleet/src/`

This workspace contains all ROS2 packages that run inside each robot container.
Every package is built together with `colcon` and launched via `robot_bringup`.

## Package Overview

| Package | Type | Node File | Role |
|---|---|---|---|
| [`shared_msgs`](./shared_msgs/) | CMake | — | Custom message definitions shared across all packages |
| [`robot_navigation`](./robot_navigation/) | Python | `robot_navigation/nav_node.py` | Odometry simulation, velocity command handling |
| [`robot_status`](./robot_status/) | Python | `robot_status/status_node.py` | Publishes robot status, event-driven |
| [`robot_core`](./robot_core/) | Python | `robot_core/core_node.py` | State machine and battery simulation |
| [`robot_bringup`](./robot_bringup/) | Python | `launch/robot_launch.py` | Launch file — starts all nodes for one robot instance |
| [`robot_location_publisher`](./robot_location_publisher/) | Python | `robot_location_publisher/location_publisher.py` | Legacy location publisher (superseded by robot_navigation) |

## Nodes per Robot

Each robot container runs **3 nodes**, launched together by `robot_bringup`:

| Node | File | Role |
|---|---|---|
| `/{ns}/core_node` | `robot_core/core_node.py` | State machine + battery simulation |
| `/{ns}/nav_node` | `robot_navigation/nav_node.py` | Odometry publisher + cmd_vel subscriber |
| `/{ns}/status_node` | `robot_status/status_node.py` | Status publisher, event-driven |

How `setup.py` maps node name to file:
```python
# example from robot_core/setup.py
entry_points={
    "console_scripts": [
        "core_node = robot_core.core_node:main",
    ],
}
```

## Topics per Robot

Each robot container has **5 topics** under its namespace:

| Topic | Direction | Message Type | Publisher | Subscriber |
|---|---|---|---|---|
| `/{ns}/status` | publish | `shared_msgs/RobotStatus` | `status_node` | rosbridge → Java backend |
| `/{ns}/status_update` | internal | `std_msgs/String` (JSON) | `core_node` | `status_node` |
| `/{ns}/odom` | publish | `nav_msgs/Odometry` | `nav_node` | `status_node` |
| `/{ns}/cmd_vel` | subscribe | `geometry_msgs/Twist` | Java backend | `nav_node` |
| `/{ns}/task_command` | subscribe | `std_msgs/String` (JSON) | Java backend | `core_node` |

## Node → Topic Flow

```
core_node ──/status_update──► status_node ──/status──► rosbridge ──► Java backend
    ▲                               ▲
    │                               │
/task_command               /odom (from nav_node)
    │
Java backend          nav_node ◄──/cmd_vel── Java backend
```

## Fleet Scale (2 robots)

| | Count |
|---|---|
| Nodes | 6 (3 per robot) |
| Topics | 10 (5 per robot) |

Plus rosbridge adds: `/rosbridge_websocket`, `/rosapi`, `/client_count`, `/connected_clients`

## Message Types Used

**Custom (defined in `shared_msgs`)**
- `shared_msgs/RobotStatus`
- `shared_msgs/TaskStatus`

**Standard ROS2**
- `nav_msgs/Odometry`
- `geometry_msgs/Twist`
- `geometry_msgs/Pose`
- `geometry_msgs/PoseStamped` *(legacy, robot_location_publisher only)*
- `std_msgs/String`
- `builtin_interfaces/Time`

## DDS Middleware

All containers use **CycloneDDS** (`RMW_IMPLEMENTATION=rmw_cyclonedds_cpp`) for reliable node discovery inside Docker. The default FastDDS uses multicast which is unreliable on Docker bridge networks.

## Build Order

`shared_msgs` must be built first because the Python packages depend on its
generated message interfaces. The `Dockerfile` handles this automatically with
two colcon passes.

```bash
# Inside the container (or for local dev):
source /opt/ros/jazzy/setup.bash
colcon build --packages-select shared_msgs
source install/setup.bash
colcon build --packages-skip shared_msgs
```

## Running a Single Robot Locally

```bash
source /opt/ros/jazzy/setup.bash
source install/setup.bash
ros2 launch robot_bringup robot_launch.py namespace:=robot1
```
