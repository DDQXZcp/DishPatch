#!/bin/bash
set -e

source /opt/ros/jazzy/setup.bash
source /ros2_ws/install/setup.bash

MAP_YAML=/ros2_ws/config/map.yaml

if [ ! -f "${MAP_YAML}" ]; then
    echo "[nav2_entrypoint] Missing Nav2 map metadata: ${MAP_YAML}" >&2
    exit 1
fi

MAP_IMAGE=$(awk -F: '/^[[:space:]]*image[[:space:]]*:/ { print $2; exit }' "${MAP_YAML}" | tr -d ' "')

if [ -z "${MAP_IMAGE}" ]; then
    echo "[nav2_entrypoint] Missing image field in ${MAP_YAML}" >&2
    exit 1
fi

case "${MAP_IMAGE}" in
    /*) MAP_IMAGE_PATH="${MAP_IMAGE}" ;;
    *) MAP_IMAGE_PATH="/ros2_ws/config/${MAP_IMAGE}" ;;
esac

if [ ! -f "${MAP_IMAGE_PATH}" ]; then
    echo "[nav2_entrypoint] Missing Nav2 map image referenced by ${MAP_YAML}: ${MAP_IMAGE_PATH}" >&2
    exit 1
fi

# Comma-separated list of robot namespaces to bring Nav2 up for.
# Example: ROBOT_NAMESPACES=robot1,robot2,robot3
NAMESPACES=${ROBOT_NAMESPACES:-robot1}

# Metres to lift the republished local costmap by, so it does not z-fight the
# map in Foxglove's 3D panel. See the costmap_viz package.
COSTMAP_Z_OFFSET=${COSTMAP_Z_OFFSET:-0.10}

# Generate per-namespace nav2 params from the template
for NS in $(echo $NAMESPACES | tr ',' ' '); do
    echo "[nav2_entrypoint] Generating params for namespace: ${NS}"
    sed "s/ROBOT_NS/${NS}/g" \
        /ros2_ws/config/nav2_params_template.yaml \
        > /tmp/nav2_params_${NS}.yaml
done

echo "[nav2_entrypoint] Launching Nav2 for namespaces: ${NAMESPACES}"
exec ros2 launch nav2_launcher multi_nav2_launch.py \
    namespaces:=${NAMESPACES} \
    costmap_z_offset:=${COSTMAP_Z_OFFSET}
