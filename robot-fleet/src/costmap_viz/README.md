# costmap_viz

Stops the local costmap and the map from fighting for the same plane in the 3D
view.

Foxglove draws `/{ns}/local_costmap/costmap` and `/{ns}/map` at the same height,
so they z-fight and flicker. They coincide exactly: the local costmap's
`global_frame` is `{ns}/odom`, and `map_to_odom_tf` publishes `map` to
`{ns}/odom` as an identity transform, putting both grids at z = 0.

Nav2 cannot be configured out of this. `Costmap2DPublisher::prepareGrid()`
hardcodes `info.origin.position.z = 0.0`, and `nav2_map_server` does the same
for the static map — the third element of `origin:` in `map.yaml` is yaw, not z.
The lift has to happen after Nav2 publishes, which is what this node is for.

**Node:** `costmap_z_offset_node` (`costmap_viz/costmap_z_offset_node.py`)

## Topics

| Topic | Direction | Message Type | Description |
|---|---|---|---|
| `{ns}/local_costmap/costmap` | **subscribe** | `nav_msgs/OccupancyGrid` | Nav2's costmap, at z = 0 |
| `{ns}/local_costmap/costmap_viz` | **publish** | `nav_msgs/OccupancyGrid` | The same grid, lifted to `z_offset` |

It republishes onto a second topic rather than the original one. Two publishers
on one name would hand Foxglove an alternating mix of raised and flat grids —
the flicker this node exists to remove. Nav2 keeps its own topic untouched;
point the 3D panel at `costmap_viz` instead.

## Parameters

| Parameter | Default | Description |
|---|---|---|
| `input_topic` | `"local_costmap/costmap"` | Costmap to read, relative to the node's namespace |
| `output_topic` | `"local_costmap/costmap_viz"` | Where to republish it, relative likewise |
| `z_offset` | `1.0` | Metres to lift the grid by |

Both topics are relative, so the node handles any costmap under its namespace —
point `input_topic` at `global_costmap/costmap` for a second instance if the
global costmap ever needs the same treatment.

## Behaviour

Only the full grid is relayed, never `costmap_updates`. The local costmap is a
rolling window, so its origin moves whenever the robot does and Nav2 republishes
the whole grid on essentially every cycle while driving, despite
`always_send_full_costmap: False` in `config/nav2_params_template.yaml`. A
stationary robot's costmap freezes on its last full grid — which is exactly what
Foxglove shows today.

QoS is `depth=1, RELIABLE, TRANSIENT_LOCAL` on both ends, the same profile
`nav2_costmap_2d` publishes with. Transient local matters on both ends for one
reason: whoever connects late still gets the current grid. Nav2 only republishes
the full costmap when the rolling window's origin moves, so a subscriber that
joins while the robot is parked would otherwise sit empty until it drives off
again — this node at startup, and a Foxglove client at any point after.

Messages are mutated and forwarded rather than rebuilt. The node runs once per
costmap cycle for every robot inside the `nav2` container, which is already short
of CPU; rebuilding the message would copy the whole occupancy array to change one
float.

## Usage

```bash
ros2 run costmap_viz costmap_z_offset_node --ros-args \
    -r __ns:=/robot1 \
    -p z_offset:=1.0
```

Normally started for you, once per namespace, by
`nav2_launcher/multi_nav2_launch.py`. The offset comes from `COSTMAP_Z_OFFSET`
on the `nav2` service — see `docker-compose.yml`.
