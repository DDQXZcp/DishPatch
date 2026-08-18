# rosbridge_relay

Joins a robot to a fleet whose ROS graph it cannot reach.

The fleet's containers find each other over DDS on one Docker network. A robot
running elsewhere — a laptop, a WSL box — has no such path: DDS discovery is
multicast, and the locators it advertises are private addresses behind NAT. The
only thing reachable from outside is the rosbridge WebSocket port, which is what
this node uses.

**Node:** `relay_node` (`rosbridge_relay/relay_node.py`)

## Topics

| Topic | Direction | Message Type | Description |
|---|---|---|---|
| `/{ns}/status` | **relayed out** | `shared_msgs/RobotStatus` | Telemetry the backend reads |
| `/{ns}/navigate_to_pose/_action/status` | **relayed out** | `action_msgs/GoalStatusArray` | Whether Nav2 holds a live goal |
| `/{ns}/goal_pose` | **relayed in** | `geometry_msgs/PoseStamped` | Navigation goal from the backend |

Only these three cross the network. Everything else Nav2 needs — tf, odom, the
costmaps, the `NavigateToPose` action itself — stays on the local graph, so the
robot navigates at full rate regardless of the link.

## Parameters

| Parameter | Default | Description |
|---|---|---|
| `rosbridge_url` | `"ws://localhost:9090"` | rosbridge server to join |
| `robot_namespace` | `"robot"` | Namespace prefix used in topic names |

## Behaviour

On connect it advertises the two uplink topics and subscribes to the downlink
one, then forwards messages in both directions as rosbridge `publish` ops.
Messages are converted with `rosidl_runtime_py`, so no type is hand-coded.

The connection is outbound only and retried every 5 seconds. While it is down,
telemetry is dropped rather than queued — a status sample from a minute ago is
not worth delivering, and the backend expires stale robots anyway.

Once `/{ns}/status` appears on the fleet's graph, the backend's own topic
discovery picks the robot up within about 10 seconds. Nothing on the fleet side
needs configuring.

## Security

The link is unauthenticated, exactly like the backend's own connection to
rosbridge: anyone who can reach the port can publish goals to any robot.
Restrict the port to known addresses.

## Usage

```bash
ros2 run rosbridge_relay relay_node --ros-args \
    -p rosbridge_url:=ws://<fleet-host>:9090 \
    -p robot_namespace:=robot3
```

Normally started for you by `scripts/robot3_entrypoint.sh`, which reads
`ROSBRIDGE_URL` and `ROBOT_NAMESPACE` — see `docker-compose.wsl.yml`.
