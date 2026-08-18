# Robot Fleet

The ROS2 side of DishPatch: simulated delivery robots that navigate a real floor
plan with Nav2, and the rosbridge WebSocket the Java backend talks to them
through.

Robots are driven by publishing a goal, not by commanding velocity. The backend
publishes a `PoseStamped` to `/{ns}/goal_pose` and reads `/{ns}/status` back.
Everything between those two topics is Nav2's problem.

## Contents

| Document | Covers |
|---|---|
| This file | Architecture, nodes, topics, and the decisions behind them |
| [TESTING_GUIDE.md](./TESTING_GUIDE.md) | Bringing the fleet up and proving it works, step by step |
| [ROBOT3_GUIDE.md](./ROBOT3_GUIDE.md) | Joining a robot from your own machine, off the fleet's ROS graph |
| [src/README.md](./src/README.md) | The ROS2 workspace and its packages |

## Containers

```bash
cd robot-fleet
docker compose up -d --build
```

| Service | Role |
|---|---|
| `rosbridge` | ROS2 to WebSocket bridge, published on host port `9090` |
| `nav2` | The Nav2 stack, shared by every robot |
| `robot1` | Robot nodes, `namespace=robot1` |
| `robot2` | Robot nodes, `namespace=robot2` |

All containers sit on the `ros_net` bridge network with `ROS_DOMAIN_ID=0`, so
they discover each other without host networking. They use **CycloneDDS**
(`RMW_IMPLEMENTATION=rmw_cyclonedds_cpp`) — the default FastDDS relies on
multicast, which is unreliable on Docker bridge networks.

Adding a robot means copying the `robot1` block, changing the service name,
`container_name`, and `ROBOT_NAMESPACE`, and adding the namespace to the `nav2`
service's `ROBOT_NAMESPACES` list.

### Why Nav2 is one container

Nav2 used to run inside each robot image, which meant `ros-jazzy-nav2-bringup`
(~1.2 GB) was installed once per robot. Consolidating it left the robot image at
roughly 1.5 GB and stopped the cost multiplying with fleet size.

That argument was about disk, never about CPU. The container still runs five
real-time nodes **per namespace**, so two robots is ten nodes. On 2026-08-11 the
controllers were missing their 20 Hz loop, dropping as low as 6 Hz, while the
planner failed to acknowledge goal requests inside Nav2's 20 ms default.
Shrinking the map from 16.8M cells to 935k removed most of that load. Measure
before adding a third robot:

```bash
nproc; docker stats --no-stream
docker logs nav2 2>&1 | grep -c "Control loop missed"
```

Split the stack per robot if that count is not near zero.

## Architecture

```
Backend (Java, via rosbridge)
    |
    +-- publish -> /{ns}/goal_pose  (PoseStamped)
    |                   |
    |           bt_navigator subscribes to this topic itself - its relative
    |           "goal_pose" subscription resolves to /{ns}/goal_pose - and
    |           sends itself the NavigateToPose goal. No relay node.
    |                   |
    |              Nav2 (nav2 container, per namespace)
    |              +-- bt_navigator       orchestrates via Behavior Tree
    |              +-- planner_server     global path (NavFn/Dijkstra)
    |              +-- controller_server  local control (RPP, 20 Hz)
    |                   |
    |              /{ns}/cmd_vel -> nav_node (fake driver)
    |                   |
    |              /{ns}/odom + TF (map -> {ns}/odom -> {ns}/base_link)
    |                   |
    |              status_node
    |              +-- odom            -> pose + speed
    |              +-- /{ns}/battery   -> battery level
    |              +-- /{ns}/sensor    -> sensor state
    |                   |
    +-- subscribe <- /{ns}/status  (RobotStatus @ 1 Hz)

hardware_node
    +-- publish -> /{ns}/battery  (Float32)  drains 0.05%/s
    +-- publish -> /{ns}/sensor   (Bool)     toggled via /{ns}/task_command
```

### Nothing else may subscribe to `goal_pose`

The fleet once ran a `goal_relay_node` that forwarded `/{ns}/goal_pose` to the
`NavigateToPose` action. `bt_navigator` was already doing exactly that, so every
goal became two action goals milliseconds apart — the second preempting and
aborting the first. `ros2 topic info /robot1/goal_pose --verbose` reported
`Subscription count: 2`.

The node still exists in `robot_navigation` but is no longer launched. Before
adding anything that listens on that topic, check the count is `1`:

```bash
docker exec nav2 bash -lc "source /opt/ros/jazzy/setup.bash && ros2 topic info /robot1/goal_pose --verbose"
```

## Nodes

### Robot container — one set per robot

| Node | Package | Role |
|---|---|---|
| `/{ns}/hardware_node` | `robot_hardware` | Battery drain and sensor simulation |
| `/{ns}/nav_node` | `robot_navigation` | Fake driver — integrates `cmd_vel` into odometry and TF |
| `/{ns}/status_node` | `robot_status` | Aggregates telemetry into `/{ns}/status` |
| `/{ns}/map_to_odom_tf` | `tf2_ros` | Static TF `map` to `{ns}/odom` (identity) |

### Nav2 container — one set per namespace

| Node | Package | Role |
|---|---|---|
| `/{ns}/map_server` | `nav2_map_server` | Serves the static map |
| `/{ns}/planner_server` | `nav2_planner` | Global path (NavFn/Dijkstra) |
| `/{ns}/controller_server` | `nav2_controller` | Produces `cmd_vel` (RPP, 20 Hz) |
| `/{ns}/bt_navigator` | `nav2_bt_navigator` | Behavior Tree orchestration; owns the `goal_pose` subscription |
| `/{ns}/lifecycle_manager` | `nav2_lifecycle_manager` | Brings the four above up on startup |

Launched by `nav2_launcher/multi_nav2_launch.py`, which takes a comma-separated
namespace list so one container serves the fleet.

## Topics

### Backend interface

| Topic | Type | Direction |
|---|---|---|
| `/{ns}/goal_pose` | `geometry_msgs/PoseStamped` | backend to robot |
| `/{ns}/status` | `shared_msgs/RobotStatus` | robot to backend, 1 Hz |
| `/{ns}/navigate_to_pose/_action/status` | `action_msgs/GoalStatusArray` | robot to backend |
| `/{ns}/task_command` | `std_msgs/String` (JSON) | backend to robot |

The backend does not have to be told which robots exist. It asks rosbridge for
the topic list and follows every `/robot{id}/status` it finds — see
`RosBridgeService` in `control-backend`.

### Internal

| Topic | Type | Publisher to Subscriber |
|---|---|---|
| `/{ns}/battery` | `std_msgs/Float32` | `hardware_node` to `status_node` |
| `/{ns}/sensor` | `std_msgs/Bool` | `hardware_node` to `status_node` |
| `/{ns}/odom` | `nav_msgs/Odometry` | `nav_node` to `status_node`, `controller_server` |
| `/{ns}/cmd_vel` | `geometry_msgs/Twist` | `controller_server` to `nav_node` |
| `/map` | `nav_msgs/OccupancyGrid` | `map_server` to costmaps |

## RobotStatus

```
string robot_id          # e.g. "robot1"
float32 battery          # percentage, 0.0 - 100.0
float32 speed            # linear speed in m/s, from odometry
bool sensor              # hardware sensor state
geometry_msgs/Pose pose  # position in the map frame
```

There is no `state` field. What a robot is *doing* is a question about the
delivery it was assigned, which only the backend knows; the robot reports facts
and the backend draws conclusions.

## TF

```
map
 +-- {ns}/odom              static, identity - map_to_odom_tf
       +-- {ns}/base_link   dynamic, 10 Hz   - nav_node
```

Frames are namespaced per robot so multiple robots do not collide on one tree.
AMCL is not used: this is a simulation, so the robot's position is known rather
than estimated, and the static transform stands in for localisation.

## The map

`config/map.png` and `config/map.yaml` are **generated**, not committed. Stage
them before starting the fleet:

```bash
bash map-source/stage-map-assets.sh
```

Edit the sources in `map-source/`, never the staged output. The real floor plan
is 60 m by 39 m.

The Nav2 grid is deliberately coarser (5 cm/pixel) than the floor plan the
dashboard renders (1.18 cm/pixel). Nav2's static layer resizes the global
costmap to whatever the map declares and ignores the resolution in the params
file, so the map's own resolution decides what every plan costs. At the
floorplan's resolution that was 16.8 million cells and ~385 ms per plan.

## Behaviour worth knowing

- **Goal tolerance** — the robot stops within 0.25 m of the goal
  (`xy_goal_tolerance` in `config/nav2_params_template.yaml`).
- **Recovery behaviors** — not used. The Behavior Tree is minimal: compute path,
  follow path.
- **Battery** — drains at 0.05%/s, auto-charges at 20% or below, stops at 95% or
  above.
- **Goals sent too early are lost** — a goal published before `bt_navigator` has
  finished coming up is not queued, it is simply not received. Wait a few
  seconds after startup.
