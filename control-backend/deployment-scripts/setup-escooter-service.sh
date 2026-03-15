#!/bin/bash

MQTT_USERNAME="$1"
MQTT_PASSWORD="$2"

SERVICE_FILE="/etc/systemd/system/escooter.service"

sudo tee $SERVICE_FILE > /dev/null <<EOF
[Unit]
Description=Escooter Python Service
After=network.target

[Service]
User=ec2-user
WorkingDirectory=/home/ec2-user/app
Environment=MQTT_USERNAME=$MQTT_USERNAME
Environment=MQTT_PASSWORD=$MQTT_PASSWORD
ExecStart=/usr/bin/python3 /home/ec2-user/app/escooter-ec2.py
Restart=always

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable escooter.service
sudo systemctl restart escooter.service