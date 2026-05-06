# Robot Fleet Testing Guide

## 1. Clone the Repository

```bash
git clone --branch ROS-add-packages https://github.com/DDQXZcp/DishPatch.git
```

## 2. Verify Requirements

### Docker
```bash
docker --version
docker compose version
```

### Node.js & wscat (for WebSocket testing)
```bash
node --version
wscat --version
```

If wscat is not installed:
```bash
sudo npm install -g wscat
```

## 3. Navigate to robot-fleet

```bash
cd DishPatch/robot-fleet
```

## 4. Build and Start the Containers

```bash
docker compose up -d --build
```

Wait seconds for all containers to start. Verify all are running:

```bash
docker compose ps
```

Expected — all four containers show `Up`:
```
NAME         STATUS
rosbridge    Up (healthy)
robot1       Up
robot2       Up
robot3       Up
```

## 5. Verify ROS Topic List

Exec into the rosbridge container and check that all robot topics are visible:

```bash
docker exec -it rosbridge bash
source /opt/ros/jazzy/setup.bash
ros2 topic list
```

Expected output includes:
```
/robot1/status
/robot1/odom
/robot2/status
/robot2/odom
/robot3/status
/robot3/odom
...
```

Type `exit` to leave the container.

## 6. Verify Topic is Publishing

Exec into the robot1 container and echo the status topic:

```bash
docker exec -it robot1 bash
source /opt/ros/jazzy/setup.bash
source /ros2_ws/install/setup.bash
ros2 topic echo /robot1/status
```

Expected — data appears every ~1 second:
```
robot_id: robot1
state: Waiting
battery: 100.0
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

With `AUTO_CYCLE=true`, the state will automatically change (Waiting → Pickup → Serving → Returning) every few seconds.

Type `exit` to leave the container.

## 7. Test WebSocket via rosbridge

Connect to rosbridge using wscat:

```bash
wscat -c ws://localhost:9090
```

Once connected, subscribe to robot1 status:

```json
{"op":"subscribe","topic":"/robot1/status","type":"shared_msgs/msg/RobotStatus"}
```

Expected — messages arrive every ~1 second:
```json
{"op":"publish","topic":"/robot1/status","msg":{"robot_id":"robot1","state":"Waiting","battery":100.0,...}}
```

Press `Ctrl+C` to disconnect.

---

## Stopping

```bash
docker compose down
```
