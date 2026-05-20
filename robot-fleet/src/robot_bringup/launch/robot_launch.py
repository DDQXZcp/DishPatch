"""
robot_launch.py — Bringup launch file for a single robot instance.

Usage (inside the container):
  ros2 launch robot_bringup robot_launch.py namespace:=robot1

Parameters forwarded to every node:
  namespace   — ROS namespace prefix, e.g. "robot1"
  robot_id    — Human-readable ID, defaults to <namespace>
  auto_cycle  — "true"/"false" — enable automatic demo state cycling (default true)
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

    auto_cycle_arg = DeclareLaunchArgument(
        "auto_cycle",
        default_value="true",
        description="Enable automatic demo state cycling in core_node",
    )

    initial_battery_arg = DeclareLaunchArgument(
        "initial_battery",
        default_value="100.0",
        description="Starting battery percentage (0-100)",
    )

    # ── Shared substitutions ───────────────────────────────────────────
    ns = LaunchConfiguration("namespace")
    robot_id = LaunchConfiguration("robot_id")
    auto_cycle = LaunchConfiguration("auto_cycle")
    initial_battery = LaunchConfiguration("initial_battery")

    # ── Nodes ──────────────────────────────────────────────────────────

    core_node = Node(
        package="robot_core",
        executable="core_node",
        name="core_node",
        namespace=ns,
        parameters=[
            {"robot_namespace": ns},
            {"robot_id": robot_id},
            {"auto_cycle": PythonExpression(['"', auto_cycle, '" == "true"'])},
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
            {"initial_battery": initial_battery},
        ],
        output="screen",
        emulate_tty=True,
    )

    return LaunchDescription(
        [
            ns_arg,
            robot_id_arg,
            auto_cycle_arg,
            initial_battery_arg,
            core_node,
            nav_node,
            status_node,
        ]
    )
