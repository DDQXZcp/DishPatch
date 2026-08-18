# Running robot3 on Your Own Machine

This guide covers joining a robot to the EC2 fleet from a machine that is not
part of it — a laptop, or WSL on your own PC.

`robot3` is one container holding a whole robot: the robot nodes, its own Nav2
stack, and a relay that carries three topics to the fleet's rosbridge. It needs
nothing from the EC2 side except a reachable port.

```
  YOUR MACHINE (WSL)                            EC2
  ┌──────────────────────────┐                  ┌────────────────────────┐
  │ robot3 container         │                  │ rosbridge      :9090   │
  │                          │   /robot3/status │                        │
  │  status_node   ──────────┼──────────────────▶  nav2                  │
  │  nav_node                │  ws://ec2:9090   │  robot1, robot2        │
  │  goal_relay_node ◀───────┼──────────────────┤                        │
  │  Nav2 (map, planner,     │ /robot3/goal_pose└────────────┬───────────┘
  │        controller, bt)   │                               │ ws
  │  relay_node              │                    control-backend
  │                          │                               │
  │  tf, odom, costmaps      │                       control-frontend
  │  never leave this box    │
  └──────────────────────────┘
```

Only `/robot3/status`, `/robot3/navigate_to_pose/_action/status` and
`/robot3/goal_pose` cross the internet. Everything Nav2 needs to plan — tf,
odometry, the costmaps, the `NavigateToPose` action — stays inside your
container, so navigation is unaffected by the quality of the link.

## Before You Start

| Requirement | Check |
|---|---|
| Docker with WSL integration | `docker compose version` |
| The fleet's rosbridge is reachable | `timeout 3 bash -c "</dev/tcp/<ec2-ip>/9090" && echo open` |
| ~4 GB free disk | The image carries `nav2-bringup` |

Two notes on where you clone:

- Prefer the WSL filesystem (`~/DishPatch`) over `/mnt/e/...`. Docker builds
  from `/mnt` are slow.
- `.gitattributes` forces `*.sh` to LF, so a Windows checkout no longer breaks
  the container entrypoints. If you cloned before that file existed, re-clone or
  run `git add --renormalize .`.

## 1. Stage the Map

Nav2 plans against the real Hive map, which is generated rather than committed:

```bash
bash map-source/stage-map-assets.sh
```

This writes `robot-fleet/config/map.png` and `map.yaml`. Skip it and the
container exits at startup with `Missing Nav2 map image`.

## 2. Point at the Fleet

The compose file defaults to the rosbridge in `application.properties`. Override
it for your deployment:

```bash
export ROSBRIDGE_URL=ws://<ec2-ip>:9090
```

## 3. Build and Run

```bash
cd robot-fleet
docker compose -f docker-compose.wsl.yml up --build
```

The first build takes 10–20 minutes, almost all of it `nav2-bringup`. Later runs
start in seconds.

## 4. Confirm It Joined

**In your own logs**, the relay reports the link and Nav2 reaches `active`:

```
[robot3_entrypoint] Launching Nav2 for robot3
[robot3_entrypoint] Relaying robot3 to ws://<ec2-ip>:9090
[rosbridge_relay_node]: Connected to rosbridge at ws://<ec2-ip>:9090
```

**On EC2**, robot3's topics are now on the fleet graph:

```bash
docker exec -it rosbridge bash -c \
  "source /opt/ros/jazzy/setup.bash && ros2 topic list | grep robot3"
```

**In the backend**, the robot is discovered on its own within about 10 seconds —
nothing to redeploy or configure:

```bash
curl https://controlapi.dish-patch.com/api/nav/health
# {"rosbridgeConnected":true,"robots":[1,2,3],"destinationsLoaded":26}
```

**In the dashboard**, `Robot 3` appears with battery and a position, and starts
driving to the counter, because the dispatcher homes any robot it has not placed
there yet.

## Driving It

Once discovered, robot3 is an ordinary fleet member: the dispatch pipeline gives
it orders like any other robot.

To send it somewhere by hand (requires `nav.test-endpoint.enabled=true`):

```bash
curl -X POST https://controlapi.dish-patch.com/api/nav/goTo \
  -H "Content-Type: application/json" \
  -d '{"robotId": 3, "destination": "T5"}'
```

Valid destinations come from `GET /api/nav/destinations`. Watch it arrive in
your container logs — `goal_relay_node` logs every goal it forwards to Nav2.

## Configuration

Set in [`docker-compose.wsl.yml`](./docker-compose.wsl.yml):

| Variable | Default | Meaning |
|---|---|---|
| `ROBOT_NAMESPACE` | `robot3` | Namespace and id. The backend reads the number from it |
| `ROSBRIDGE_URL` | `ws://15.135.131.146:9090` | Fleet rosbridge to join. Unset runs local-only |
| `INITIAL_X` / `INITIAL_Y` | `18.128` / `9.241` | Spawn point in map metres — drop point T3 |
| `INITIAL_THETA` | `0.0` | Spawn heading in radians |
| `INITIAL_BATTERY` | `100.0` | Starting battery percentage |
| `ROS_DOMAIN_ID` | `0` | Only has to avoid clashing with other ROS on your machine |

The spawn point must be free space in the staged map. Drop point poses are
listed in [`map-source/the-hive-drop-points.yaml`](../map-source/the-hive-drop-points.yaml);
robot1 starts on T1 and robot2 on T2.

## Adding robot4, robot5, …

Copy `docker-compose.wsl.yml`, change `ROBOT_NAMESPACE`, `container_name` and
the spawn point. The id must be unique across the whole fleet — two robots
publishing `/robot3/status` will overwrite each other in the backend.

## Stopping

```bash
docker compose -f docker-compose.wsl.yml down
```

The robot disappears from the dashboard about 20 seconds later, when its
telemetry expires. `/api/nav/health` keeps listing it until the backend's own
rosbridge connection is re-established — that list is which topics the backend
subscribed to, not which robots are alive.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `Cannot reach rosbridge at ws://… — retrying in 5s` | Port 9090 not reachable from your network | Check the EC2 security group allows your IP, then re-test the port as above |
| `Missing Nav2 map image` at startup | Map never staged before the build | Run `bash map-source/stage-map-assets.sh`, then rebuild with `--build` |
| `bad interpreter: No such file or directory` | Entrypoint checked out with CRLF | `git add --renormalize .` or re-clone with `.gitattributes` present |
| `robot3` topics on EC2, but no telemetry in the dashboard | Status is being relayed but not read | On EC2: `docker exec -it rosbridge bash -c "source /opt/ros/jazzy/setup.bash && source /ros2_ws/install/setup.bash && ros2 topic echo /robot3/status"` |
| Robot appears, then vanishes every few seconds | Link dropping; telemetry expires after 20s | Look for `rosbridge link lost` in your logs — usually an unstable connection or the EC2 rosbridge restarting |
| Goal accepted, robot does not move | Nav2 not up, or the goal is off-map | Check for `NavigateToPose action server not available` and the lifecycle_manager logs; verify the destination against `/api/nav/destinations` |
| Robot drives, but the dashboard position is stale | Relay uplink broken while Nav2 runs fine | The two are independent by design; check the relay's log lines specifically |

To look at the local graph directly:

```bash
docker exec -it robot3 bash -c \
  "source /opt/ros/jazzy/setup.bash && source /ros2_ws/install/setup.bash && ros2 topic list"
```

## How It Works

- [`Dockerfile.robot3`](./Dockerfile.robot3) — the combined image
- [`scripts/robot3_entrypoint.sh`](./scripts/robot3_entrypoint.sh) — starts Nav2,
  the robot nodes and the relay; if any one exits, the container goes down and
  Docker restarts it
- [`src/rosbridge_relay/`](./src/rosbridge_relay/) — the relay node, and why the
  link works this way rather than over DDS
