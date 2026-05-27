# Map Source

This folder is the source of truth for the Nav2 map used by `robot-fleet`.

## Files

- `the-hive-landscape-mask-nav2.yaml` — Nav2 map metadata.
- `the-hive-landscape-mask-nav2.png` — occupancy map image referenced by the YAML.
- `the-hive-drop-points.yaml` — drop-point metadata derived from the same map.

## Deployment Flow

The robot fleet deploy workflow watches `map-source/**`.

During deployment, `.github/workflows/deploy-robot-fleet.yml` runs:

```bash
bash robot-fleet/scripts/stage_nav2_map.sh
```

That script copies this source map into the Docker build context as:

```text
robot-fleet/config/map.yaml
robot-fleet/config/map.png
```

The staged `map.yaml` keeps the source metadata, but normalizes the image field to:

```yaml
image: map.png
```

Inside the Nav2 container, those files become:

```text
/ros2_ws/config/map.yaml
/ros2_ws/config/map.png
```

## Local Test

From the repo root:

```bash
bash robot-fleet/scripts/stage_nav2_map.sh
bash robot-fleet/scripts/stage_nav2_map.sh --check
docker compose -f robot-fleet/docker-compose.yml config >/dev/null
```

If those pass, the map files are staged correctly for the Robot Fleet Docker build.
