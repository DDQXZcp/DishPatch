# robot_navigation

Simulates robot movement and handles velocity commands.

**Node:** `nav_node` (`robot_navigation/nav_node.py`)

## Topics

| Topic | Direction | Message Type | Description |
|---|---|---|---|
| `/{ns}/odom` | **publish** | `nav_msgs/Odometry` | Estimated robot position and velocity at 10 Hz |
| `/{ns}/cmd_vel` | **subscribe** | `geometry_msgs/Twist` | Incoming velocity commands from the backend |

Also broadcasts a `odom → base_link` TF transform on every tick.

## Message Types

| Message | Source |
|---|---|
| `nav_msgs/Odometry` | ROS2 standard |
| `geometry_msgs/Twist` | ROS2 standard |

## Parameters

| Parameter | Default | Description |
|---|---|---|
| `robot_namespace` | `"robot"` | Namespace prefix used in topic names |
| `publish_rate` | `10.0` | Odometry publish frequency in Hz |
| `initial_radius` | `2.0` | Starting distance from origin in metres |

## Motion Model

Uses a simple unicycle model integrated at each timer tick:

```
theta += angular_z * dt
x     += linear_x * cos(theta) * dt
y     += linear_x * sin(theta) * dt
```

Default velocity (`linear_x=0.5 m/s`, `angular_z=0.25 rad/s`) produces a
circular path. Receiving a `cmd_vel` message overwrites these values immediately.
