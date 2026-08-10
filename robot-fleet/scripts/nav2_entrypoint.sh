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

# Namespaces to bring Nav2 up for.
#
# Normally derived from ROBOT_COUNT (the single knob in .env / docker-compose):
#   ROBOT_COUNT=3  ->  robot1,robot2,robot3
#
# ROBOT_NAMESPACES still wins if set explicitly, for the rare case where the
# namespaces are not a contiguous robot1..robotN range.
if [ -n "${ROBOT_NAMESPACES}" ]; then
    NAMESPACES="${ROBOT_NAMESPACES}"
else
    COUNT=${ROBOT_COUNT:-1}
    case "${COUNT}" in
        ''|*[!0-9]*)
            echo "[nav2_entrypoint] ROBOT_COUNT must be a positive integer, got '${COUNT}'" >&2
            exit 1
            ;;
    esac
    if [ "${COUNT}" -lt 1 ]; then
        echo "[nav2_entrypoint] ROBOT_COUNT must be >= 1, got '${COUNT}'" >&2
        exit 1
    fi
    NAMESPACES=$(seq -s, -f "robot%g" 1 "${COUNT}")
fi

# Generate per-namespace nav2 params from the template
for NS in $(echo $NAMESPACES | tr ',' ' '); do
    echo "[nav2_entrypoint] Generating params for namespace: ${NS}"
    sed "s/ROBOT_NS/${NS}/g" \
        /ros2_ws/config/nav2_params_template.yaml \
        > /tmp/nav2_params_${NS}.yaml
done

echo "[nav2_entrypoint] Launching Nav2 for namespaces: ${NAMESPACES}"
exec ros2 launch nav2_launcher multi_nav2_launch.py \
    namespaces:=${NAMESPACES}
