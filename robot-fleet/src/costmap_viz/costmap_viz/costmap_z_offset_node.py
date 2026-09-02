"""
costmap_z_offset_node.py — lifts a costmap off the floor for the 3D view

Foxglove draws `/{ns}/local_costmap/costmap` and `/{ns}/map` on the same plane,
so the two grids z-fight and flicker over each other. They coincide exactly:
the local costmap's `global_frame` is `{ns}/odom`, and `map_to_odom_tf` in
robot_bringup publishes `map -> {ns}/odom` as an identity transform, so both
land at z = 0.

Nav2 has no parameter for this. `Costmap2DPublisher::prepareGrid()` hardcodes
`info.origin.position.z = 0.0`, and `nav2_map_server` does the same for the
static map — the third element of `origin:` in map.yaml is yaw, not z. The
offset has to be applied after Nav2 has published.

So this node subscribes to the costmap, raises `info.origin.position.z`, and
republishes it on a second topic:

    /{ns}/local_costmap/costmap       unchanged, z = 0     (Nav2)
    /{ns}/local_costmap/costmap_viz   raised,    z_offset  (this node)

A second topic and not the same one: two publishers on one name would hand
Foxglove an alternating mix of raised and flat grids, which is the flicker this
exists to remove. Nav2 keeps its own topic; point the 3D panel at the new one.

Only the full grid is relayed, never `costmap_updates`. The local costmap is a
rolling window, so its origin moves whenever the robot does, and Nav2 republishes
the whole grid on essentially every cycle while driving despite
`always_send_full_costmap: False`. A stationary robot's costmap freezes on its
last full grid — which is what Foxglove already shows today.

Parameters:
    input_topic   — costmap to read, relative to this node's namespace
    output_topic  — where to republish it, relative likewise
    z_offset      — metres to lift the grid by
"""

import rclpy
from nav_msgs.msg import OccupancyGrid
from rclpy.node import Node
from rclpy.qos import DurabilityPolicy, HistoryPolicy, QoSProfile, ReliabilityPolicy

# The same QoS nav2_costmap_2d publishes with — rclcpp::QoS(1).transient_local().
# Transient local matters on both ends, for the same reason: whoever connects
# late still gets the current grid. Nav2 only republishes the full costmap when
# the rolling window's origin moves, so a subscriber that joins while the robot
# is parked would otherwise sit empty until it drives off again — this node at
# startup, and a Foxglove client at any point after.
COSTMAP_QOS = QoSProfile(
    depth=1,
    history=HistoryPolicy.KEEP_LAST,
    reliability=ReliabilityPolicy.RELIABLE,
    durability=DurabilityPolicy.TRANSIENT_LOCAL,
)


class CostmapZOffsetNode(Node):
    def __init__(self):
        super().__init__("costmap_z_offset_node")

        self.declare_parameter("input_topic", "local_costmap/costmap")
        self.declare_parameter("output_topic", "local_costmap/costmap_viz")
        self.declare_parameter("z_offset", 1.0)

        input_topic = self.get_parameter("input_topic").value
        output_topic = self.get_parameter("output_topic").value
        self._z_offset = float(self.get_parameter("z_offset").value)

        self._publisher = self.create_publisher(OccupancyGrid, output_topic, COSTMAP_QOS)
        self.create_subscription(OccupancyGrid, input_topic, self._republish, COSTMAP_QOS)

        self.get_logger().info(
            f"costmap_z_offset_node started — {input_topic} -> {output_topic} "
            f"at z = {self._z_offset:.3f} m"
        )

    def _republish(self, grid: OccupancyGrid) -> None:
        # Mutated and forwarded rather than copied. This runs once per costmap
        # cycle for every robot inside the nav2 container, which is already short
        # of CPU — rebuilding the message would copy the whole occupancy array to
        # change one float.
        grid.info.origin.position.z = self._z_offset
        self._publisher.publish(grid)


def main(args=None):
    rclpy.init(args=args)
    node = CostmapZOffsetNode()
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()


if __name__ == "__main__":
    main()
