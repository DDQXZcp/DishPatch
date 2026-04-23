#!/usr/bin/env bash
# ============================================================
# DishPatch — ROS2 Sim Robot Launcher
# ============================================================
# Starts rosbridge (WebSocket on port 9090) and the simulated
# robot node.
#
# Prerequisites:
#   sudo apt install ros-jazzy-rosbridge-suite
#   source /opt/ros/jazzy/setup.bash
#
# Usage:
#   chmod +x run_sim.sh
#   ./run_sim.sh
# ============================================================

set -e

ROS_SETUP="/opt/ros/jazzy/setup.bash"

if [ ! -f "$ROS_SETUP" ]; then
    echo "ERROR: ROS 2 Jazzy not found at $ROS_SETUP"
    echo "Install it with: sudo apt install ros-jazzy-desktop"
    exit 1
fi

source "$ROS_SETUP"

echo "─────────────────────────────────────────────────"
echo " DishPatch — Starting ROS2 simulation environment"
echo "─────────────────────────────────────────────────"
echo ""
echo " rosbridge WebSocket server → port 9090"
echo " Simulated robot node       → 10 robots"
echo ""
echo " Backend connects to: ws://<WSL_IP>:9090"
echo "─────────────────────────────────────────────────"
echo ""

# Launch rosbridge in the background
echo "[1/2] Starting rosbridge_suite..."
ros2 launch rosbridge_server rosbridge_websocket_launch.xml port:=9090 &
ROSBRIDGE_PID=$!

# Give rosbridge time to start
sleep 2

# Run the sim robot node in the foreground
echo "[2/2] Starting sim_robot_node..."
python3 "$(dirname "$0")/sim_robot_node.py"

# On exit (Ctrl+C), kill rosbridge
kill $ROSBRIDGE_PID 2>/dev/null
wait $ROSBRIDGE_PID 2>/dev/null
echo "Stopped."
