#!/usr/bin/env python3
"""
DishPatch — ROS2 Simulated Delivery Robot Node
===============================================
Purpose:
    Simulates multiple delivery robots publishing their state (status,
    position, battery) to ROS2 topics. The backend connects to these
    topics via rosbridge_suite (WebSocket on port 9090).

How it works:
    [ROS2 Node] ──topics──> [rosbridge :9090] ──WebSocket──> [Spring Boot]

Run rosbridge first (separate terminal):
    ros2 launch rosbridge_server rosbridge_websocket_launch.xml port:=9090

Then run this node:
    python3 sim_robot_node.py

Topic summary per robot (id = 1..ROBOT_COUNT):
    PUBLISH (robot → backend):
        /robot/robot_{id}/status    std_msgs/String    "Serving"|"Pickup"|"Returning"|"Waiting"|"Maintenance"
        /robot/robot_{id}/position  geometry_msgs/Point  x, y (z always 0)
        /robot/robot_{id}/battery   std_msgs/Float32   0.0–100.0

Requirements:
    sudo apt install ros-jazzy-rosbridge-suite
    source /opt/ros/jazzy/setup.bash
"""

import random
import rclpy
from rclpy.node import Node
from std_msgs.msg import String, Float32
from geometry_msgs.msg import Point


# ---------------------------------------------------------------------------
# Simulation constants
# ---------------------------------------------------------------------------

PUBLISH_INTERVAL_SEC = 5.0
ROBOT_COUNT          = 10
MAP_X_MAX            = 200
MAP_Y_MAX            = 1000

STATUSES = ['Serving', 'Pickup', 'Returning', 'Waiting', 'Maintenance']


# ---------------------------------------------------------------------------
# Robot helpers
# ---------------------------------------------------------------------------

def create_robots(count=ROBOT_COUNT):
    """Creates a list of robots with random initial state."""
    robots = []
    for i in range(count):
        robot_id = i + 1
        battery  = random.randint(0, 90)
        if battery <= 10:
            status = 'Maintenance'
        else:
            status = random.choice(STATUSES)
        speed = 0 if status in ('Maintenance', 'Waiting') else random.randint(10, 25)
        robots.append({
            'id':      robot_id,
            'name':    f'Robot {robot_id}',
            'x':       float(random.randint(0, MAP_X_MAX)),
            'y':       float(random.randint(0, MAP_Y_MAX)),
            'battery': float(battery),
            'status':  status,
            'speed':   speed,
        })
    return robots


def update_status(r):
    """Returns the next status based on current status and battery level."""
    if r['battery'] <= 10 and r['status'] != 'Maintenance':
        return 'Waiting'
    if r['status'] == 'Serving':
        return random.choices(['Serving', 'Returning', 'Maintenance'], weights=[60, 35, 5], k=1)[0]
    elif r['status'] == 'Pickup':
        return random.choices(['Pickup', 'Serving', 'Maintenance'], weights=[35, 60, 5], k=1)[0]
    elif r['status'] == 'Returning':
        return random.choices(['Returning', 'Waiting', 'Maintenance'], weights=[60, 35, 5], k=1)[0]
    elif r['status'] == 'Waiting':
        if r['battery'] <= 30:
            return 'Waiting'
        return random.choices(['Waiting', 'Pickup', 'Maintenance'], weights=[60, 35, 5], k=1)[0]
    else:
        return random.choices(['Maintenance', 'Waiting'], weights=[25, 75], k=1)[0]


def update_robot(r):
    """Updates status, battery, speed, and position of a robot for one tick."""
    r['status'] = update_status(r)
    if r['status'] in ('Waiting', 'Maintenance'):
        r['speed'] = 0
    else:
        r['speed'] = random.randint(10, 25)

    if r['status'] == 'Waiting':
        r['battery'] = min(100.0, r['battery'] + random.randint(5, 10))
    elif r['status'] != 'Maintenance':
        r['battery'] = max(0.0, r['battery'] - random.randint(3, 5))

    if r['speed'] > 0:
        r['x'] = min(float(MAP_X_MAX), max(0.0, r['x'] + random.randint(-5, 5)))
        r['y'] = min(float(MAP_Y_MAX), max(0.0, r['y'] + random.randint(-25, 25)))

    return r


# ---------------------------------------------------------------------------
# ROS2 Node
# ---------------------------------------------------------------------------

class SimRobotNode(Node):

    def __init__(self):
        """Initializes publishers for each robot and starts the publish timer."""
        super().__init__('sim_robot')

        self._robots     = create_robots(ROBOT_COUNT)
        self._robot_pubs = {}

        for r in self._robots:
            rid = r['id']
            self._robot_pubs[rid] = {
                'status':   self.create_publisher(String,  f'/robot/robot_{rid}/status', 10),
                'position': self.create_publisher(Point,   f'/robot/robot_{rid}/position', 10),
                'battery':  self.create_publisher(Float32, f'/robot/robot_{rid}/battery', 10),
            }

        self.create_timer(PUBLISH_INTERVAL_SEC, self._publish_state)

        self.get_logger().info(
            f'SimRobotNode started — {ROBOT_COUNT} robots simulated.\n'
            f'Publishing every {PUBLISH_INTERVAL_SEC}s via ROS2 topics.\n'
            f'Make sure rosbridge is running: '
            f'ros2 launch rosbridge_server rosbridge_websocket_launch.xml port:=9090'
        )

    def _publish_state(self):
        """Called every PUBLISH_INTERVAL_SEC. Updates and publishes all robot states."""
        for r in self._robots:
            update_robot(r)
            rid  = r['id']
            pubs = self._robot_pubs[rid]

            status_msg   = String();  status_msg.data  = r['status']
            position_msg = Point();   position_msg.x   = r['x']; position_msg.y = r['y']; position_msg.z = 0.0
            battery_msg  = Float32(); battery_msg.data = float(r['battery'])

            pubs['status'].publish(status_msg)
            pubs['position'].publish(position_msg)
            pubs['battery'].publish(battery_msg)

            self.get_logger().info(
                f'Robot {rid} → status={r["status"]} '
                f'pos=({r["x"]:.1f},{r["y"]:.1f}) '
                f'bat={r["battery"]:.1f}%'
            )


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main(args=None):
    rclpy.init(args=args)
    node = SimRobotNode()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        node.get_logger().info('Shutting down SimRobotNode.')
    finally:
        node.destroy_node()
        rclpy.shutdown()


if __name__ == '__main__':
    main()
