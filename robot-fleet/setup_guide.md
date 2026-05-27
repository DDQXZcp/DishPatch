### Command for initializing ROS2 Package
```
mkdir -p src
cd src

ros2 pkg create robot_location_publisher \
  --build-type ament_python \
  --dependencies rclpy geometry_msgs
```
