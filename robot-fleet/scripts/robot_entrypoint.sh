#!/bin/bash
set -e

source /opt/ros/jazzy/setup.bash
source /ros2_ws/install/setup.bash

NS=${ROBOT_NAMESPACE:-robot}

# Generate nav2 params for this robot (replace ROBOT_NS placeholder)
sed "s/ROBOT_NS/${NS}/g" \
    /ros2_ws/config/nav2_params_template.yaml \
    > /tmp/nav2_params_${NS}.yaml

exec ros2 launch robot_bringup robot_launch.py \
    namespace:=${NS} \
    robot_id:=${NS} \
    initial_battery:=${INITIAL_BATTERY:-100.0} \
    nav2_params:=/tmp/nav2_params_${NS}.yaml
