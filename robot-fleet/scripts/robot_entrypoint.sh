#!/bin/bash
set -e

source /opt/ros/jazzy/setup.bash
source /ros2_ws/install/setup.bash

NS=${ROBOT_NAMESPACE:-robot}

exec ros2 launch robot_bringup robot_launch.py \
    namespace:=${NS} \
    robot_id:=${NS} \
    initial_battery:=${INITIAL_BATTERY:-100.0} \
    initial_x:=${INITIAL_X:-0.0} \
    initial_y:=${INITIAL_Y:-0.0} \
    initial_theta:=${INITIAL_THETA:-0.0}
