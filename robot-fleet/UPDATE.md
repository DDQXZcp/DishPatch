# Robot Fleet — Nav2 Integration Update

Branch: `ROS-goal-pose-command`

---

## Summary

Full integration of Nav2 (ROS2 Navigation Stack) into the robot-fleet.
Robots now use Nav2 for real path planning and motion control — no longer a circular motion simulation.
Backend interface unchanged: publish to `/{ns}/goal_pose`, subscribe from `/{ns}/status`.

Key changes:
- `robot_core` package removed — replaced by `robot_hardware` (battery + sensor simulator)
- `core_node` state machine removed — robot state is now determined by the backend based on `RobotStatus`
- `status_update` topic removed — `status_node` is now a pure aggregator of sensor topics
- `RobotStatus` updated: removed `state`, added `speed` and `sensor`
- TF frames namespaced per robot to avoid multi-robot conflicts
- New `goal_relay_node`: bridge from `goal_pose` topic → `NavigateToPose` action
- Full Nav2 stack: `map_server`, `planner_server`, `controller_server`, `bt_navigator`, `lifecycle_manager`

---

## Architecture

```
Backend (Java via rosbridge)
    │
    ├── publish → /{ns}/goal_pose  (PoseStamped)
    │                   │
    │           goal_relay_node.py
    │           subscribe topic → call NavigateToPose action
    │                   │
    │              Nav2 Stack
    │              ├── bt_navigator      (orchestrate via BT)
    │              ├── planner_server    (global path, NavFn/Dijkstra)
    │              └── controller_server (local control, RPP, 20 Hz)
    │                   │
    │              /{ns}/cmd_vel → nav_node.py (fake driver)
    │                   │
    │              /{ns}/odom + TF ({ns}/odom → {ns}/base_link)
    │                   │
    │           status_node.py
    │           subscribe odom → pose + speed
    │           subscribe /{ns}/battery → battery level
    │           subscribe /{ns}/sensor  → sensor state
    │                   │
    └── subscribe ← /{ns}/status  (RobotStatus: robot_id, battery, speed, sensor, pose)

hardware_node.py
    ├── publish → /{ns}/battery  (Float32)  — drain 0.05%/s, charge when <= 20%
    └── publish → /{ns}/sensor   (Bool)     — toggled via /{ns}/task_command
```

**Static TF:** `map → {ns}/odom` per robot — no AMCL needed, no TF conflicts.

---

## Nodes per Robot

| Node | Package | Role |
|---|---|---|
| `/{ns}/hardware_node` | `robot_hardware` | Battery drain + sensor simulation, publishes `/{ns}/battery` and `/{ns}/sensor` |
| `/{ns}/nav_node` | `robot_navigation` | Nav2 fake driver — integrates cmd_vel → odom + TF |
| `/{ns}/goal_relay_node` | `robot_navigation` | Bridges `/{ns}/goal_pose` topic → `NavigateToPose` action |
| `/{ns}/status_node` | `robot_status` | Aggregates sensor data → publishes `/{ns}/status` to backend |
| `/{ns}/map_to_odom_tf` | `tf2_ros` | Static TF `map → {ns}/odom` (identity) |
| `/{ns}/map_server` | `nav2_map_server` | Serves static map (`map.pgm`) |
| `/{ns}/planner_server` | `nav2_planner` | Computes global path (NavFn/Dijkstra) |
| `/{ns}/controller_server` | `nav2_controller` | Computes cmd_vel (RPP, 20 Hz) |
| `/{ns}/bt_navigator` | `nav2_bt_navigator` | Orchestrates navigation via Behavior Tree |
| `/{ns}/lifecycle_manager` | `nav2_lifecycle_manager` | Activates/deactivates Nav2 nodes on startup |

---

## Topics per Robot

### Backend Interface

| Topic | Type | Direction | Notes |
|---|---|---|---|
| `/{ns}/goal_pose` | `geometry_msgs/PoseStamped` | Backend → Robot | Navigation goal |
| `/{ns}/status` | `shared_msgs/RobotStatus` | Robot → Backend | Robot status @ 1 Hz |
| `/{ns}/task_command` | `std_msgs/String` (JSON) | Backend → Robot | `{"command": "sensor_on/off"}` |

### Internal Topics

| Topic | Type | Publisher → Subscriber |
|---|---|---|
| `/{ns}/battery` | `std_msgs/Float32` | `hardware_node` → `status_node` |
| `/{ns}/sensor` | `std_msgs/Bool` | `hardware_node` → `status_node` |
| `/{ns}/odom` | `nav_msgs/Odometry` | `nav_node` → `status_node`, `controller_server` |
| `/{ns}/cmd_vel` | `geometry_msgs/Twist` | `controller_server` → `nav_node` |
| `/map` | `nav_msgs/OccupancyGrid` | `map_server` → costmaps |

---

## RobotStatus Message

```
string robot_id          # Unique robot identifier, e.g. "robot1"
float32 battery          # Battery percentage 0.0 – 100.0
float32 speed            # Linear speed in m/s (from odometry)
bool sensor              # Hardware sensor state
geometry_msgs/Pose pose  # Current position in map frame
```

`string state` removed — robot state is determined by the backend based on received data.

---

## File Changes

### Removed
- `src/robot_core/` — entire package removed

### New Package: `src/robot_hardware/`
- `robot_hardware/hardware_node.py` — battery drain simulation + sensor publisher

### Updated
- `src/shared_msgs/msg/RobotStatus.msg` — removed `state`, added `speed` + `sensor`
- `src/robot_navigation/robot_navigation/nav_node.py` — namespaced TF, removed circular motion
- `src/robot_navigation/robot_navigation/goal_relay_node.py` — **new**, bridges topic → Nav2 action
- `src/robot_navigation/package.xml` — added `nav2_msgs`
- `src/robot_navigation/setup.py` — added `goal_relay_node` entry point
- `src/robot_status/robot_status/status_node.py` — pure aggregator, removed internal battery drain
- `src/robot_bringup/launch/robot_launch.py` — added Nav2 nodes + static TF, removed core_node
- `Dockerfile.robot` — added `nav2-bringup`, copy config + scripts, use entrypoint script

### New Files
- `config/nav2_params_template.yaml` — Nav2 config with `ROBOT_NS` placeholder replaced per robot at startup
- `config/map.yaml` — map metadata, 10m×10m, 5cm/pixel
- `config/navigate_to_pose.xml` — Behavior Tree: compute path → follow path
- `config/navigate_through_poses.xml` — Behavior Tree required by bt_navigator at startup
- `scripts/robot_entrypoint.sh` — generates nav2 params per robot → launches ROS

---

## TF Tree per Robot

```
map
 └── {ns}/odom          (static, identity — from map_to_odom_tf)
       └── {ns}/base_link  (dynamic, 10 Hz — from nav_node)
```

---

## Build & Run

```bash
cd robot-fleet
docker compose up --build
```

---

## Testing

### Send goal from terminal (inside container)

```bash
ros2 topic pub --once /{ns}/goal_pose geometry_msgs/msg/PoseStamped \
  "{header: {frame_id: 'map'}, pose: {position: {x: 2.0, y: 1.5, z: 0.0}, orientation: {w: 1.0}}}"
```

### Send goal via rosbridge (WebSocket)

```json
{"op":"publish","topic":"/robot1/goal_pose","type":"geometry_msgs/msg/PoseStamped","msg":{"header":{"frame_id":"map","stamp":{"sec":0,"nanosec":0}},"pose":{"position":{"x":2.0,"y":1.5,"z":0.0},"orientation":{"x":0.0,"y":0.0,"z":0.0,"w":1.0}}}}
```

### Monitor status

```json
{"op":"subscribe","topic":"/robot1/status","type":"shared_msgs/msg/RobotStatus"}
```

---

## Notes

- **Map:** All free space, 10m×10m. Replace `config/map.pgm` + `config/map.yaml` with a real floor plan — no Nav2 code changes needed.
- **Goal tolerance:** Robot stops within 0.25m of the goal (`xy_goal_tolerance` in `nav2_params_template.yaml`).
- **AMCL:** Not used — robot position is always known (simulation without localization sensors).
- **Recovery behaviors:** Not used — minimal BT: compute path → follow path.
- **Robot state:** Determined by the backend based on received `RobotStatus`, not inside the robot.
- **Battery:** Drains at 0.05%/s in `hardware_node`. Auto-charges when <= 20%, stops at >= 95%.
