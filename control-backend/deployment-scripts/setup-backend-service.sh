#!/bin/bash

SERVICE_NAME=campusride-backend
REMOTE_DIR=/home/ec2-user/app
JAR_NAME=campusride-backend-1.0.0.jar

MQTT_USERNAME=$1
MQTT_PASSWORD=$2

SERVICE_FILE=/etc/systemd/system/${SERVICE_NAME}.service

sudo tee $SERVICE_FILE > /dev/null <<EOF
[Unit]
Description=CampusRide Backend Service
After=network.target

[Service]
User=ec2-user
WorkingDirectory=$REMOTE_DIR
ExecStart=/usr/bin/java -jar $REMOTE_DIR/$JAR_NAME
Restart=on-failure
Environment=MQTT_USERNAME=$MQTT_USERNAME
Environment=MQTT_PASSWORD=$MQTT_PASSWORD

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable $SERVICE_NAME
sudo systemctl restart $SERVICE_NAME
