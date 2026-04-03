#!/usr/bin/env python3
"""
DishPatch — ROS2 Simulated Delivery Robot Node
===============================================
Purpose:
    Simulates multiple delivery robots and sends their state (id, name,
    status, position, battery, speed) to the Spring Boot backend via
    WebSocket using the STOMP protocol.

How it works:
    [ROS2 Node] ──STOMP WebSocket:8080──> [Spring Boot Backend]

Run Spring Boot backend first, then:
    python3 sim_robot_node.py

Requirements:
    pip install rclpy websocket-client
"""

import json
import random
import rclpy
from rclpy.node import Node
import websocket


# ---------------------------------------------------------------------------
# Simulation constants
# ---------------------------------------------------------------------------

PUBLISH_INTERVAL_SEC = 5.0
ROBOT_COUNT          = 10
MAP_X_MAX            = 200
MAP_Y_MAX            = 1000
BACKEND_WS_URL       = "ws://172.27.16.1:8080/ws/websocket"

STATUSES = ['Serving', 'Pickup', 'Returning', 'Waiting', 'Maintenance']


# ---------------------------------------------------------------------------
# Robot helpers
# ---------------------------------------------------------------------------

def create_robots(count=ROBOT_COUNT):
    robots = []
    for i in range(count):
        robot_id = i + 1
        battery  = random.randint(0, 90)
        if battery <= 10:
            status = "Maintenance"
        else:
            status = STATUSES[random.randint(0, 4)]
        speed = 0 if status in ("Maintenance", "Waiting") else random.randint(10, 25)
        robots.append({
            "id":      robot_id,
            "name":    f"Robot {robot_id}",
            "x":       random.randint(0, MAP_X_MAX),
            "y":       random.randint(0, MAP_Y_MAX),
            "battery": battery,
            "status":  status,
            "speed":   speed,
        })
    return robots


def update_status(r):
    if r["battery"] <= 10 and r["status"] != "Maintenance":
        return "Waiting"
    if r["status"] == "Serving":
        return random.choices(["Serving", "Returning", "Maintenance"], weights=[60, 35, 5], k=1)[0]
    elif r["status"] == "Pickup":
        return random.choices(["Pickup", "Serving", "Maintenance"], weights=[35, 60, 5], k=1)[0]
    elif r["status"] == "Returning":
        return random.choices(["Returning", "Waiting", "Maintenance"], weights=[60, 35, 5], k=1)[0]
    elif r["status"] == "Waiting":
        if r["battery"] <= 30:
            return "Waiting"
        return random.choices(["Waiting", "Pickup", "Maintenance"], weights=[60, 35, 5], k=1)[0]
    else:
        return random.choices(["Maintenance", "Waiting"], weights=[25, 75], k=1)[0]


def move_robot(r):
    if r["speed"] == 0:
        return r
    r["x"] = min(MAP_X_MAX, max(0, r["x"] + random.randint(-5, 5)))
    r["y"] = min(MAP_Y_MAX, max(0, r["y"] + random.randint(-25, 25)))
    r["speed"] = random.randint(10, 25)
    return r


def update_robot(r):
    r["status"] = update_status(r)
    if r["status"] in ("Waiting", "Maintenance"):
        r["speed"] = 0
    if r["status"] == "Waiting":
        r["battery"] = min(100, r["battery"] + random.randint(5, 10))
    elif r["status"] != "Maintenance":
        r["battery"] = max(0, r["battery"] - random.randint(3, 5))
    return move_robot(r)


# ---------------------------------------------------------------------------
# ROS2 Node
# ---------------------------------------------------------------------------

class SimRobotNode(Node):

    def __init__(self):
        super().__init__('sim_robot')

        self._robots = create_robots()
        self._ws     = self._connect_stomp()

        self.create_timer(PUBLISH_INTERVAL_SEC, self._publish_state)

        self.get_logger().info(
            f'SimRobotNode started — {ROBOT_COUNT} robots simulated.\n'
            f'Sending to {BACKEND_WS_URL} every {PUBLISH_INTERVAL_SEC}s.'
        )

    def _connect_stomp(self):
        self.get_logger().info(f'Connecting to {BACKEND_WS_URL} ...')
        ws = websocket.create_connection(BACKEND_WS_URL)
        ws.send("CONNECT\naccept-version:1.2\nheart-beat:0,0\n\n\x00")
        result = ws.recv()
        self.get_logger().info(f'STOMP handshake: {result.strip()}')
        return ws

    def _publish_state(self):
        updates = [update_robot(r) for r in self._robots]
        frame = (
            f"SEND\n"
            f"destination:/app/robot-data\n"
            f"content-type:application/json\n\n"
            f"{json.dumps(updates)}\x00"
        )
        self._ws.send(frame)
        self.get_logger().info('Sent robot data to backend.')


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
