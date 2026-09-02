#!/bin/bash
# ── Standalone robot entrypoint ───────────────────────────────────────────────
# Runs a complete robot in one container: its own Nav2 stack, the robot nodes,
# and the relay that carries its topics to a rosbridge on another machine.
#
# Used for a robot that is not on the fleet's ROS graph — a laptop or WSL box
# joining the EC2 fleet, where DDS cannot reach and only the rosbridge
# WebSocket can.
#
#   ROBOT_NAMESPACE   namespace for this robot, e.g. robot3
#   ROSBRIDGE_URL     ws://<host>:9090 to join; unset runs local-only
#   COSTMAP_Z_OFFSET  metres to lift the republished local costmap by (see costmap_viz)
# ──────────────────────────────────────────────────────────────────────────────
set -e

source /opt/ros/jazzy/setup.bash
source /ros2_ws/install/setup.bash

NS=${ROBOT_NAMESPACE:-robot3}
MAP_YAML=/ros2_ws/config/map.yaml

# ── Map check ─────────────────────────────────────────────────────────────────
# Same contract as the nav2 container: the map is staged into config/ before
# the image is built, by map-source/stage-map-assets.sh.
if [ ! -f "${MAP_YAML}" ]; then
    echo "[robot3_entrypoint] Missing Nav2 map metadata: ${MAP_YAML}" >&2
    exit 1
fi

MAP_IMAGE=$(awk -F: '/^[[:space:]]*image[[:space:]]*:/ { print $2; exit }' "${MAP_YAML}" | tr -d ' "')

case "${MAP_IMAGE}" in
    /*) MAP_IMAGE_PATH="${MAP_IMAGE}" ;;
    *) MAP_IMAGE_PATH="/ros2_ws/config/${MAP_IMAGE}" ;;
esac

if [ -z "${MAP_IMAGE}" ] || [ ! -f "${MAP_IMAGE_PATH}" ]; then
    echo "[robot3_entrypoint] Missing Nav2 map image referenced by ${MAP_YAML}: ${MAP_IMAGE_PATH}" >&2
    echo "[robot3_entrypoint] Run map-source/stage-map-assets.sh and rebuild." >&2
    exit 1
fi

# ── Nav2 params for this namespace ────────────────────────────────────────────
echo "[robot3_entrypoint] Generating Nav2 params for namespace: ${NS}"
sed "s/ROBOT_NS/${NS}/g" \
    /ros2_ws/config/nav2_params_template.yaml \
    > /tmp/nav2_params_${NS}.yaml

# ── Children ──────────────────────────────────────────────────────────────────
# All three go down together: a robot with no Nav2, or Nav2 with no robot, is
# not something to keep running. Docker restarts the container as a whole.
PIDS=()

cleanup() {
    kill "${PIDS[@]}" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "[robot3_entrypoint] Launching Nav2 for ${NS}"
ros2 launch nav2_launcher multi_nav2_launch.py \
    namespaces:=${NS} \
    costmap_z_offset:=${COSTMAP_Z_OFFSET:-1.0} &
PIDS+=($!)

echo "[robot3_entrypoint] Launching robot nodes for ${NS}"
ros2 launch robot_bringup robot_launch.py \
    namespace:=${NS} \
    robot_id:=${NS} \
    initial_battery:=${INITIAL_BATTERY:-100.0} \
    initial_x:=${INITIAL_X:-0.0} \
    initial_y:=${INITIAL_Y:-0.0} \
    initial_theta:=${INITIAL_THETA:-0.0} &
PIDS+=($!)

if [ -n "${ROSBRIDGE_URL:-}" ]; then
    echo "[robot3_entrypoint] Relaying ${NS} to ${ROSBRIDGE_URL}"
    ros2 run rosbridge_relay relay_node --ros-args \
        -p rosbridge_url:="${ROSBRIDGE_URL}" \
        -p robot_namespace:="${NS}" &
    PIDS+=($!)
else
    echo "[robot3_entrypoint] ROSBRIDGE_URL not set — running on the local graph only"
fi

# First child to exit takes the container with it.
wait -n
