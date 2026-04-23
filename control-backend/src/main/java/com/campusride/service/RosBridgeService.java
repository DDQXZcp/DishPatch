package com.campusride.service;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import org.springframework.web.socket.CloseStatus;

import java.util.logging.Logger;

/**
 * Connects to rosbridge as a WebSocket client and subscribes to ROS2 topics
 * published by the simulation node.
 *
 * Topics subscribed (per robot id 1..robotCount):
 *   /robot/robot_{id}/status    std_msgs/String
 *   /robot/robot_{id}/position  geometry_msgs/Point
 *   /robot/robot_{id}/battery   std_msgs/Float32
 *
 * Configure in application.properties:
 *   rosbridge.url=ws://<IP>:9090
 *   rosbridge.robot-count=10
 */
@Service
public class RosBridgeService extends TextWebSocketHandler {

    private static final Logger logger = Logger.getLogger(RosBridgeService.class.getName());

    @Value("${rosbridge.url}")
    private String rosbridgeUrl;

    @Value("${rosbridge.robot-count}")
    private int robotCount;

    @Autowired
    private ScooterService scooterService;

    private WebSocketSession session;

    /**
     * Initiates a WebSocket connection to rosbridge on startup.
     * Retries every 5 seconds until the connection is established.
     */
    @PostConstruct
    public void connect() {
        new Thread(() -> {
            while (true) {
                try {
                    logger.info("RosBridgeService connecting to " + rosbridgeUrl);
                    new StandardWebSocketClient().execute(this, rosbridgeUrl);
                    return;
                } catch (Exception e) {
                    logger.warning("Failed to connect to rosbridge, retrying in 5s: " + e.getMessage());
                    try {
                        Thread.sleep(5000);
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        return;
                    }
                }
            }
        }).start();
    }

    /**
     * Called when the WebSocket connection to rosbridge is established.
     * Subscribes to all robot topics based on robotCount from config.
     */
    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        this.session = session;
        logger.info("Connected to rosbridge at " + rosbridgeUrl);

        for (int i = 1; i <= robotCount; i++) {
            subscribe("/robot/robot_" + i + "/status",   "std_msgs/String");
            subscribe("/robot/robot_" + i + "/position", "geometry_msgs/Point");
            subscribe("/robot/robot_" + i + "/battery",  "std_msgs/Float32");
        }

        logger.info("Subscribed to " + (robotCount * 3) + " ROS2 topics.");
    }

    /**
     * Called on each incoming message from rosbridge.
     * Parses the topic and field, then forwards to ScooterService.updateField().
     */
    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        try {
            JsonObject json = JsonParser.parseString(message.getPayload()).getAsJsonObject();

            if (!"publish".equals(json.get("op").getAsString())) return;

            String     topic = json.get("topic").getAsString();
            JsonObject msg   = json.getAsJsonObject("msg");

            // Topic format: /robot/robot_{id}/{field}
            String[] parts = topic.split("/"); // ["", "robot", "robot_1", "field"]
            if (parts.length < 4) return;

            int    id    = Integer.parseInt(parts[2].replace("robot_", ""));
            String field = parts[3];

            scooterService.updateField(id, field, msg);

        } catch (Exception e) {
            logger.warning("Error handling rosbridge message: " + e.getMessage());
        }
    }

    /**
     * Called when the rosbridge connection is closed.
     * Waits 5 seconds then attempts to reconnect.
     */
    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        logger.warning("Rosbridge disconnected (" + status + "). Reconnecting in 5s...");
        try {
            Thread.sleep(5000);
            connect();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    /**
     * Sends a rosbridge subscribe request for the given ROS2 topic.
     *
     * @param topic ROS2 topic name e.g. "/robot/robot_1/status"
     * @param type  ROS2 message type e.g. "std_msgs/String"
     */
    private void subscribe(String topic, String type) throws Exception {
        String payload = String.format(
            "{\"op\":\"subscribe\",\"topic\":\"%s\",\"type\":\"%s\"}", topic, type
        );
        session.sendMessage(new TextMessage(payload));
    }
}
