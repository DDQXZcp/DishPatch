import time
import json
import random
import os
import websocket


ws = websocket.create_connection(f"ws://localhost:8080/ws/websocket")

ws.send("CONNECT\naccept-version:1.2\nheart-beat:0,0\n\n\x00")
result = ws.recv()
print("STOMP handshake:", result)

# Define robots (with internal simulation data if needed)
robots = [
    {
        "id": 1, "name": "Testy Tester 1", "status": "Running",
        "start": [-35.2769, 149.1198], "end": [-35.2755, 149.1211],
        "battery_range": (70, 80), "progress": 0.0, "forward": True
    },
    {
        "id": 53, "name": "Robot 2", "status": "Running",
        "start": [-35.2789, 149.1238], "end": [-35.2767, 149.1201],
        "battery_range": (50, 60), "progress": 0.0, "forward": True
    },
    {
        "id": 3, "name": "Robot 3", "status": "Running",
        "start": [-35.2736, 149.1179], "end": [-35.2769, 149.1150],
        "battery_range": (30, 40), "progress": 0.0, "forward": True
    },
    {
        "id": 4, "name": "Robot 4", "status": "Locked",
        "lat": -35.2785, "lng": 149.1200, "battery": 56
    },
    {
        "id": 5, "name": "Robot 5", "status": "Maintenance",
        "lat": -35.2772, "lng": 149.1220, "battery": 3
    },
    {
        "id": 6, "name": "Robot 6", "status": "Running",
        "start": [-35.2755, 149.1248], "end": [-35.2772, 149.1233],
        "battery_range": (70, 80), "progress": 0.0, "forward": True
    },
    {
        "id": 7, "name": "Robot 7", "status": "Running",
        "start": [-35.2788, 149.1219], "end": [-35.2804, 149.1207],
        "battery_range": (50, 60), "progress": 0.0, "forward": True
    },
    {
        "id": 9, "name": "Robot 9", "status": "Locked",
        "lat": -35.2766, "lng": 149.1165, "battery": 34
    },
    {
        "id": 10, "name": "Robot 10", "status": "Maintenance",
        "lat": -35.2772, "lng": 149.1220, "battery": 5
    }
]

def create_robots(count=10):
    robots = []
    # for i in range(count):
    #     id = i+1
    #     name = "Robot " + id
    #     lat = 
    #     long = 
    #     status = 
    #     battery = 0 if status == 'Maintenance' else 90

    #     robot = {"id": id, "name": name, "lat": lat, "long": long, "battery": battery, "status": status}
    #     robots.append(robot)
    
    return robots

# Simulate movement
def move_scooter(s):
    if s["forward"]:
        s["progress"] += 0.01
        if s["progress"] >= 1.0:
            s["progress"] = 1.0
            s["forward"] = False
    else:
        s["progress"] -= 0.01
        if s["progress"] <= 0.0:
            s["progress"] = 0.0
            s["forward"] = True

    lat = s["start"][0] + (s["end"][0] - s["start"][0]) * s["progress"]
    lng = s["start"][1] + (s["end"][1] - s["start"][1]) * s["progress"]
    battery = random.randint(*s["battery_range"])
    speed = random.randint(10, 25)

    return {
        "id": s["id"],
        "name": s["name"],
        "status": s["status"],
        "lat": round(lat, 6),
        "lng": round(lng, 6),
        "battery": battery,
        "speed": speed
    }

# For static scooters (locked, maintenance)
def static_scooter(s):
    return {
        "id": s["id"],
        "name": s["name"],
        "status": s["status"],
        "lat": s["lat"],
        "lng": s["lng"],
        "battery": s["battery"],
        "speed": 0
    }

print("Starting robot simulator...")
while True:
    updates = []
    for r in robots:
        if r["status"] == "Running":
            updates.append(move_scooter(r))
        else:
            updates.append(static_scooter(r))

    frame = f"SEND\ndestination:/app/robot-data\ncontent-type:application/json\n\n{json.dumps(updates)}\x00"
    ws.send(frame)
    print("Sending Payload")
    # print("Published:", updates)
    time.sleep(5)