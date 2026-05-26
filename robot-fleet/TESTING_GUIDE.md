# Robot Fleet Testing Guide

This guide covers the current Nav2-based robot fleet setup.

The active compose stack starts:

- `rosbridge` on host port `9090`
- `nav2`, shared by the fleet
- `robot1`
- `robot2`

Robots are moved by publishing a `geometry_msgs/PoseStamped` goal to `/{ns}/goal_pose`.
The robot-side `goal_relay_node` forwards that topic message to Nav2's
`NavigateToPose` action.

## 1. Verify Requirements

```bash
docker --version
docker compose version
```

For WebSocket testing through rosbridge, `wscat` is useful:

```bash
node --version
wscat --version
```

If `wscat` is not installed:

```bash
sudo npm install -g wscat
```

## 2. Start the Fleet

From the repository root:

```bash
cd robot-fleet
docker compose up -d --build
```

Wait a few seconds for ROS discovery and Nav2 lifecycle startup, then verify the
containers:

```bash
docker compose ps
```

Expected services:

```text
rosbridge
nav2
robot1
robot2
```

All should show `Up`. `rosbridge` may also show `healthy`.

## 3. Verify ROS Topics

Use the `rosbridge` container to inspect the ROS graph:

```bash
docker exec -it rosbridge bash
source /opt/ros/jazzy/setup.bash
source /ros2_ws/install/setup.bash
ros2 topic list
```

Expected topics include:

```text
/robot1/goal_pose
/robot1/status
/robot1/odom
/robot2/goal_pose
/robot2/status
/robot2/odom
```

Type `exit` to leave the container.

## 4. Verify Nav2 Action Servers

Nav2 should expose one `navigate_to_pose` action per robot namespace:

```bash
docker exec -it nav2 bash
source /opt/ros/jazzy/setup.bash
source /ros2_ws/install/setup.bash
ros2 action list
```

Expected actions include:

```text
/robot1/navigate_to_pose
/robot2/navigate_to_pose
```

Type `exit` to leave the container.

## 5. Send a Navigation Goal

Move `robot1` to `(2.0, 1.5)` in the `map` frame:

```bash
docker exec -it robot1 bash
source /opt/ros/jazzy/setup.bash
source /ros2_ws/install/setup.bash

ros2 topic pub --once /robot1/goal_pose geometry_msgs/msg/PoseStamped \
  "{header: {frame_id: 'map'}, pose: {position: {x: 2.0, y: 1.5, z: 0.0}, orientation: {w: 1.0}}}"
```

Move `robot2` by changing the namespace and target coordinates:

```bash
ros2 topic pub --once /robot2/goal_pose geometry_msgs/msg/PoseStamped \
  "{header: {frame_id: 'map'}, pose: {position: {x: -1.5, y: 2.0, z: 0.0}, orientation: {w: 1.0}}}"
```

The generated test map is 10m x 10m with origin `[-5, -5]`, so use goal
coordinates roughly between `-5` and `5` for both `x` and `y`.

If a goal is sent too early, `goal_relay_node` can drop it while waiting for the
Nav2 action server. Wait a few seconds after startup and publish the goal again.

## 6. Monitor Robot Status

Echo the status topic:

```bash
ros2 topic echo /robot1/status
```

Expected fields:

```text
robot_id: robot1
battery: 99.9
speed: 0.0
sensor: false
pose:
  position:
    x: 0.0
    y: 0.0
    z: 0.0
  orientation:
    x: 0.0
    y: 0.0
    z: 0.0
    w: 1.0
---
```

While the robot is navigating, `speed` should become non-zero and `pose.position`
should move toward the target. The old `state` field has been removed; robot
state is now derived by the backend from `RobotStatus`.

You can also inspect odometry directly:

```bash
ros2 topic echo /robot1/odom
```

Type `exit` to leave the container when finished.

## 7. Test Through rosbridge

Connect to rosbridge:

```bash
wscat -c ws://localhost:9090
```

Subscribe to robot status:

```json
{"op":"subscribe","topic":"/robot1/status","type":"shared_msgs/msg/RobotStatus"}
```

Publish a navigation goal:

```json
{"op":"publish","topic":"/robot1/goal_pose","type":"geometry_msgs/msg/PoseStamped","msg":{"header":{"frame_id":"map","stamp":{"sec":0,"nanosec":0}},"pose":{"position":{"x":2.0,"y":1.5,"z":0.0},"orientation":{"x":0.0,"y":0.0,"z":0.0,"w":1.0}}}}
```

Expected status messages arrive about once per second and show changing `speed`
and `pose` while the robot moves.

Press `Ctrl+C` to disconnect from `wscat`.

## 8. Stop the Fleet

```bash
docker compose down
```
