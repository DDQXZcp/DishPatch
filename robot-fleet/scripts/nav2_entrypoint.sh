#!/bin/bash
set -e

source /opt/ros/jazzy/setup.bash
source /ros2_ws/install/setup.bash

# Comma-separated list of robot namespaces to bring Nav2 up for.
# Example: ROBOT_NAMESPACES=robot1,robot2,robot3
NAMESPACES=${ROBOT_NAMESPACES:-robot1}

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
