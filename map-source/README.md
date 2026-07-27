# Map Source

This folder is the source of truth for the map assets used by `robot-fleet`,
`control-frontend`, and `control-backend`.

## Files

- `the-hive-landscape-mask-nav2.yaml` — Nav2 map metadata.
- `the-hive-landscape-mask-nav2.png` — occupancy map image referenced by the YAML.
- `the-hive-floorplan-landscape.webp` — visual floorplan used by the control frontend.
- `the-hive-drop-points.yaml` — drop-point metadata in the ROS map frame.
- `stage-map-assets.sh` — stages normalized runtime files into each service.

## Staging

From the repo root:

```bash
bash map-source/stage-map-assets.sh
bash map-source/stage-map-assets.sh --check
```

The staging script writes:

```text
robot-fleet/config/map.yaml
robot-fleet/config/map.png
control-frontend/public/maps/map-floorplan.webp
control-frontend/public/maps/map-manifest.json
control-backend/config/drop-points.json
```

The staged `robot-fleet/config/map.yaml` keeps the source metadata, but
normalizes the image field to:

```yaml
image: map.png
```

`robot-fleet/scripts/stage_nav2_map.sh` is kept as a compatibility wrapper
around `stage-map-assets.sh`.

All staged outputs except `robot-fleet/config/map.yaml` are gitignored. They are
generated, so edit `the-hive-drop-points.yaml` and re-run the script rather than
editing them by hand.

## Control Backend Drop Points

`control-backend/config/drop-points.json` is derived from
`the-hive-drop-points.yaml`:

```json
{
  "map": "the-hive-landscape-mask-nav2.yaml",
  "frameId": "map",
  "resolution": 0.011802,
  "origin": [0.0, 0.0, 0.0],
  "dropPoints": [
    { "id": "table_1", "x": 8.911, "y": 9.241, "yaw": 0.0 },
    { "id": "room_7", "x": 41.154, "y": 14.729, "yaw": 0.0 }
  ]
}
```

| Field | Type | Source | Notes |
| --- | --- | --- | --- |
| `map` | string | `map` | Filename of the Nav2 map metadata. |
| `frameId` | string | `frame_id` | ROS frame the poses are expressed in. Defaults to `map`. |
| `resolution` | number | `resolution` | Meters per pixel. |
| `origin` | number[3] | `origin` | ROS map origin as `[x, y, yaw]`. |
| `dropPoints` | object[] | `drop_points` | One entry per delivery destination. |
| `dropPoints[].id` | string | `drop_points[].id` | Destination name — see below. |
| `dropPoints[].x` | number | `drop_points[].pose.x` | Meters in the ROS map frame. |
| `dropPoints[].y` | number | `drop_points[].pose.y` | Meters in the ROS map frame. |
| `dropPoints[].yaw` | number | `drop_points[].pose.yaw` | Radians. Defaults to `0.0`. |

There are 25 drop points, one per delivery destination on the floorplan:
`table_1` … `table_18` and `room_1` … `room_7`. Each `id` matches the label
printed on that shape in `the-hive-floorplan-landscape.webp`, so a POS order for
`table_4` resolves directly to the drop point of the same name.

The `pixel` field in the source YAML is authoring metadata used to place each
drop point against the floorplan image. It is **not** carried into the staged
JSON — the control backend only consumes ROS-frame poses. Array order carries no
meaning; look entries up by `id`.

## Local Test

From the repo root:

```bash
bash map-source/stage-map-assets.sh
bash map-source/stage-map-assets.sh --check
bash robot-fleet/scripts/stage_nav2_map.sh --check
docker compose -f robot-fleet/docker-compose.yml config >/dev/null
```
