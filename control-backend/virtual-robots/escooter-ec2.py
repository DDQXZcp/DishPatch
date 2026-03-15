import time
import json
import random
import os
import paho.mqtt.client as mqtt

# Remove dotenv
MQTT_USERNAME = os.getenv("MQTT_USERNAME")
MQTT_PASSWORD = os.getenv("MQTT_PASSWORD")

# if not MQTT_USERNAME or not MQTT_PASSWORD:
#     raise RuntimeError("Missing MQTT credentials in environment variables")

# MQTT setup (TLS)
BROKER = "m178f7c2.ala.asia-southeast1.emqxsl.com"
PORT = 8883
TOPIC = "scooter/data"
CA_CERT = os.path.join(os.path.dirname(__file__), "/home/ec2-user/emqxsl-ca.crt")

client = mqtt.Client()
client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)
client.tls_set(ca_certs=CA_CERT)
client.connect(BROKER, PORT, 60)

# Define scooters (with internal simulation data if needed)
scooters = [
    {
        "id": 1, "name": "Scooter 1", "status": "Running",
        "start": [-35.2769, 149.1198], "end": [-35.2755, 149.1211],
        "battery_range": (70, 80), "progress": 0.0, "forward": True
    },
    {
        "id": 2, "name": "Scooter 2", "status": "Running",
        "start": [-35.2789, 149.1238], "end": [-35.2767, 149.1201],
        "battery_range": (50, 60), "progress": 0.0, "forward": True
    },
    {
        "id": 3, "name": "Scooter 3", "status": "Running",
        "start": [-35.2736, 149.1179], "end": [-35.2769, 149.1150],
        "battery_range": (30, 40), "progress": 0.0, "forward": True
    },
    {
        "id": 4, "name": "Scooter 4", "status": "Locked",
        "lat": -35.2785, "lng": 149.1200, "battery": 56
    },
    {
        "id": 5, "name": "Scooter 5", "status": "Maintenance",
        "lat": -35.2772, "lng": 149.1220, "battery": 3
    },
    {
        "id": 6, "name": "Scooter 6", "status": "Running",
        "start": [-35.2755, 149.1248], "end": [-35.2772, 149.1233],
        "battery_range": (70, 80), "progress": 0.0, "forward": True
    },
    {
        "id": 7, "name": "Scooter 7", "status": "Running",
        "start": [-35.2788, 149.1219], "end": [-35.2804, 149.1207],
        "battery_range": (50, 60), "progress": 0.0, "forward": True
    },
    {
        "id": 9, "name": "Scooter 9", "status": "Locked",
        "lat": -35.2766, "lng": 149.1165, "battery": 34
    },
    {
        "id": 10, "name": "Scooter 10", "status": "Maintenance",
        "lat": -35.2772, "lng": 149.1220, "battery": 5
    }
]

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

print("Starting scooter simulator...")
while True:
    updates = []
    for s in scooters:
        if s["status"] == "Running":
            updates.append(move_scooter(s))
        else:
            updates.append(static_scooter(s))

    message = json.dumps(updates)
    client.publish(TOPIC, message)
    print("Published:", message)
    time.sleep(2)