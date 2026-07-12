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

## Local Test

From the repo root:

```bash
bash map-source/stage-map-assets.sh
bash map-source/stage-map-assets.sh --check
bash robot-fleet/scripts/stage_nav2_map.sh --check
docker compose -f robot-fleet/docker-compose.yml config >/dev/null
```
