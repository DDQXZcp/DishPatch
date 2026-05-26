#!/bin/bash
set -e

source /opt/ros/jazzy/setup.bash
source /ros2_ws/install/setup.bash

NS=${ROBOT_NAMESPACE:-robot}

exec ros2 launch robot_bringup robot_launch.py \
    namespace:=${NS} \
    robot_id:=${NS} \
    initial_battery:=${INITIAL_BATTERY:-100.0}
