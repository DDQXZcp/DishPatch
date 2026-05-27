"""
robot_launch.py — Bringup launch file for a single robot instance.

Usage (inside the container):
  ros2 launch robot_bringup robot_launch.py namespace:=robot1

Parameters:
  namespace       — ROS namespace prefix, e.g. "robot1"
  robot_id        — Human-readable ID, defaults to <namespace>
  initial_battery — Starting battery percentage (0-100)
  initial_x/y/theta — Initial map-frame pose for the fake odometry driver

Note: The Nav2 stack (map_server, planner_server, controller_server,
bt_navigator, lifecycle_manager) runs in a separate `nav2` container.
This launch file only brings up the robot-specific nodes.
"""

from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument
from launch.substitutions import LaunchConfiguration, PythonExpression
from launch_ros.actions import Node


def generate_launch_description():
    # ── Declare arguments ──────────────────────────────────────────────
    ns_arg = DeclareLaunchArgument(
        "namespace",
        default_value="robot",
        description="Namespace for this robot (e.g. robot1, robot2)",
    )
    robot_id_arg = DeclareLaunchArgument(
        "robot_id",
        default_value=LaunchConfiguration("namespace"),
        description="Robot identifier string",
    )
    initial_battery_arg = DeclareLaunchArgument(
        "initial_battery",
        default_value="100.0",
        description="Starting battery percentage (0-100)",
    )
    initial_x_arg = DeclareLaunchArgument(
        "initial_x",
        default_value="0.0",
        description="Initial robot x position in the map frame",
    )
    initial_y_arg = DeclareLaunchArgument(
        "initial_y",
        default_value="0.0",
        description="Initial robot y position in the map frame",
    )
    initial_theta_arg = DeclareLaunchArgument(
        "initial_theta",
        default_value="0.0",
        description="Initial robot yaw in radians",
    )

    # ── Shared substitutions ───────────────────────────────────────────
    ns = LaunchConfiguration("namespace")
    robot_id = LaunchConfiguration("robot_id")
    initial_battery = LaunchConfiguration("initial_battery")
    initial_x = LaunchConfiguration("initial_x")
    initial_y = LaunchConfiguration("initial_y")
    initial_theta = LaunchConfiguration("initial_theta")

    ns_odom = PythonExpression(["'", ns, "/odom'"])

    # ── Custom nodes ───────────────────────────────────────────────────

    hardware_node = Node(
        package="robot_hardware",
        executable="hardware_node",
        name="hardware_node",
        namespace=ns,
        parameters=[
            {"robot_namespace": ns},
            {"robot_id": robot_id},
            {"initial_battery": initial_battery},
        ],
        output="screen",
        emulate_tty=True,
    )

    nav_node = Node(
        package="robot_navigation",
        executable="nav_node",
        name="nav_node",
        namespace=ns,
        parameters=[
            {"robot_namespace": ns},
            {"initial_x": initial_x},
            {"initial_y": initial_y},
            {"initial_theta": initial_theta},
        ],
        output="screen",
        emulate_tty=True,
    )

    goal_relay_node = Node(
        package="robot_navigation",
        executable="goal_relay_node",
        name="goal_relay_node",
        namespace=ns,
        parameters=[{"robot_namespace": ns}],
        output="screen",
        emulate_tty=True,
    )

    status_node = Node(
        package="robot_status",
        executable="status_node",
        name="status_node",
        namespace=ns,
        parameters=[
            {"robot_namespace": ns},
            {"robot_id": robot_id},
        ],
        output="screen",
        emulate_tty=True,
    )

    # ── Static TF: map → {ns}/odom ────────────────────────────────────
    map_to_odom_tf = Node(
        package="tf2_ros",
        executable="static_transform_publisher",
        name="map_to_odom_tf",
        namespace=ns,
        arguments=["0", "0", "0", "0", "0", "0", "map", ns_odom],
        output="screen",
    )

    return LaunchDescription([
        ns_arg,
        robot_id_arg,
        initial_battery_arg,
        initial_x_arg,
        initial_y_arg,
        initial_theta_arg,
        # custom nodes
        hardware_node,
        nav_node,
        goal_relay_node,
        status_node,
        # static TF
        map_to_odom_tf,
    ])
