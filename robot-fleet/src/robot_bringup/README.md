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
| `initial_x` / `initial_y` / `initial_theta` | `"0.0"` | Starting map-frame pose for the fake odometry driver |

## Nodes Launched

| Node | Package | Key topics |
|---|---|---|
| `hardware_node` | `robot_hardware` | publishes `/{ns}/battery`, `/{ns}/sensor`, subscribes `/{ns}/task_command` |
| `nav_node` | `robot_navigation` | publishes `/{ns}/odom`, subscribes `/{ns}/cmd_vel` |
| `status_node` | `robot_status` | publishes `/{ns}/status`, subscribes `/{ns}/odom`, `/{ns}/battery`, `/{ns}/sensor` |
| `map_to_odom_tf` | `tf2_ros` | static transform `map` to `{ns}/odom` |

Nav2 is **not** launched here — it runs in the separate `nav2` container, once
per namespace. This launch file brings up only the robot-specific nodes, so a
robot started on its own will report status and hold still until Nav2 is there
to plan for it.

`goal_relay_node` is deliberately not launched either; see
[../../README.md](../../README.md).

## Adding a New Robot

To launch a second robot on the same machine (outside Docker), open a new terminal and run:

```bash
ros2 launch robot_bringup robot_launch.py namespace:=robot2 initial_battery:=75.0
```

Both robots will share the same ROS domain and their topics will be fully isolated
by namespace.
