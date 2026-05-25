# robot_bringup

Launch package that starts all robot nodes together for a single robot instance.

**Launch file:** `launch/robot_launch.py`

## Usage

```bash
ros2 launch robot_bringup robot_launch.py namespace:=robot1
```

## Launch Arguments

| Argument | Default | Description |
|---|---|---|
| `namespace` | `"robot"` | Namespace prefix for all topics and nodes (e.g. `robot1`, `robot2`) |
| `robot_id` | *(same as namespace)* | Human-readable ID written into status messages |
| `initial_battery` | `"100.0"` | Starting battery level (0–100) |

## Nodes Launched

| Node | Package | Key topics |
|---|---|---|
| `core_node` | `robot_core` | publishes `/{ns}/status_update`, subscribes `/{ns}/task_command` |
| `nav_node` | `robot_navigation` | publishes `/{ns}/odom`, subscribes `/{ns}/cmd_vel` |
| `status_node` | `robot_status` | publishes `/{ns}/status`, `/{ns}/battery`, subscribes `/{ns}/odom`, `/{ns}/sensor` |

## Adding a New Robot

To launch a second robot on the same machine (outside Docker), open a new terminal and run:

```bash
ros2 launch robot_bringup robot_launch.py namespace:=robot2 initial_battery:=75.0
```

Both robots will share the same ROS domain and their topics will be fully isolated
by namespace.
