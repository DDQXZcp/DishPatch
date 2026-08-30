import math
import time
import json
import random
import os
import websocket


ws = websocket.create_connection("ws://localhost:8081/ws/websocket")

ws.send("CONNECT\naccept-version:1.2\nheart-beat:0,0\n\n\x00")
result = ws.recv()
print("STOMP handshake:", result)

statuses = ['Serving', 'Pickup', 'Returning', 'Waiting', 'Maintenance']
MAX_X = 5084
MAX_Y = 3302

def create_robots(count=10):
    robots = []
    for i in range(count):
        id = i+1
        name = "Robot " + f'{id}'
        battery = random.randint(0, 90)
        x = random.randint(0, MAX_X)
        y = random.randint(0, MAX_Y)
        if battery <= 10:
            status = "Maintenance"
        else:
            status_ind = random.randint(0, 4)
            status = statuses[status_ind]
        speed = 0 if (status == "Maintenance" or status == "Waiting") else random.randint(100, 250)
        robot = {"id": id, "name": name, "x": x, "y": y, "yaw": 0.0, "battery": battery, "status": status, "speed": speed}
        robots.append(robot)

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

    # 50% chance to move, equal chance to move positive or negative
    dx = random.randint(0, 1) * random.choice([r["speed"], -r["speed"]])
    dy = random.randint(0, 1) * random.choice([r["speed"], -r["speed"]])
    r["x"] = min(MAX_X, max(0, r["x"] + dx))
    r["y"] = min(MAX_Y, max(0, r["y"] + dy))
    if dx != 0 or dy != 0:
        r["yaw"] = math.atan2(dy, dx)
    return r

def update_robot(r):
    r["status"] = update_status(r)
    if r["status"] == "Waiting" or r["status"] == "Maintenance":
        r["speed"] = 0
    else:
        r["speed"] = random.randint(100, 250)

    if r["status"] == "Waiting":
        r["battery"] = min(100, r["battery"] + random.randint(5, 10))
    elif r["status"] != "Maintenance":
        r["battery"] = max(0, r["battery"] - random.randint(3, 5))

    return move_robot(r)


print("Starting robot simulator...")
robots = create_robots()
while True:
    updates = []
    for r in robots:
        updates.append(update_robot(r))

    frame = f"SEND\ndestination:/app/robot-data\ncontent-type:application/json\n\n{json.dumps(updates)}\x00"
    ws.send(frame)
    print("Sending Payload")
    # print("Published:", updates)
    time.sleep(5)
