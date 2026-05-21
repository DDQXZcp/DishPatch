"""
robot_launch.py — Bringup launch file for a single robot instance.

Usage (inside the container):
  ros2 launch robot_bringup robot_launch.py namespace:=robot1

Parameters forwarded to every node:
  namespace   — ROS namespace prefix, e.g. "robot1"
  robot_id    — Human-readable ID, defaults to <namespace>
"""

from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument
from launch.substitutions import LaunchConfiguration
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

    # ── Shared substitutions ───────────────────────────────────────────
    ns = LaunchConfiguration("namespace")
    robot_id = LaunchConfiguration("robot_id")
    initial_battery = LaunchConfiguration("initial_battery")

    # ── Nodes ──────────────────────────────────────────────────────────

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

    goal_relay_node = Node(
        package="robot_navigation",
        executable="goal_relay_node",
        name="goal_relay_node",
        namespace=ns,
        parameters=[
            {"robot_namespace": ns},
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
        ],
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

    return LaunchDescription(
        [
            ns_arg,
            robot_id_arg,
            initial_battery_arg,
            hardware_node,
            nav_node,
            goal_relay_node,
            status_node,
        ]
    )
