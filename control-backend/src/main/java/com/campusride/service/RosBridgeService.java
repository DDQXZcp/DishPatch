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

import java.util.Locale;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.logging.Logger;

/**
 * Connects to rosbridge as a WebSocket client to exchange ROS2 topics with the
 * robot fleet.
 *
 * Subscribes (per robot id 1..robotCount):
 *   /robot{id}/status    shared_msgs/msg/RobotStatus   (robot_id, battery, speed, sensor, pose)
 *
 * Publishes (on demand, via {@link #publishGoal}):
 *   /robot{id}/goal_pose geometry_msgs/PoseStamped     navigation goal in the "map" frame
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

    /** Robot ids whose goal_pose topic has been advertised on the current session. */
    private final Set<Integer> advertisedGoals = ConcurrentHashMap.newKeySet();

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
        advertisedGoals.clear(); // new session — previous advertisements no longer valid
        logger.info("Connected to rosbridge at " + rosbridgeUrl);

        for (int i = 1; i <= robotCount; i++) {
            subscribe("/robot" + i + "/status",   "shared_msgs/msg/RobotStatus");
        }

        logger.info("Subscribed to " + robotCount + " ROS2 topics.");

        // TEMP smoke-test: publish one goal to robot1 on connect — REMOVE after verifying
        // Thread.sleep(3000); // give Nav2 action server time to come up before goal_relay_node forwards
        // publishGoal(1, 4.0, 4.0, 0.0);
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

            // Topic format: /robot{id}/{field}
            String[] parts = topic.split("/"); // ["", "robot1", "field"]
            if (parts.length < 3) return;

            int    id    = Integer.parseInt(parts[1].replace("robot", ""));
            String field = parts[2];

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

    /**
     * Publishes a navigation goal to {@code /robot{id}/goal_pose} via rosbridge.
     * The topic is advertised once per robot before its first publish on the
     * current session.
     *
     * @param id  robot id (matches the {@code /robot{id}} namespace)
     * @param x   goal X in the "map" frame
     * @param y   goal Y in the "map" frame
     * @param yaw goal heading in radians (0 = facing +X); converted to a 2D quaternion
     */
    public void publishGoal(int id, double x, double y, double yaw) throws Exception {
        if (session == null || !session.isOpen()) {
            logger.warning("Cannot publish goal for robot " + id + " — rosbridge not connected");
            return;
        }

        String topic = "/robot" + id + "/goal_pose";

        if (advertisedGoals.add(id)) {
            session.sendMessage(new TextMessage(String.format(
                "{\"op\":\"advertise\",\"topic\":\"%s\",\"type\":\"geometry_msgs/PoseStamped\"}", topic
            )));
        }

        double oz = Math.sin(yaw / 2.0);
        double ow = Math.cos(yaw / 2.0);

        String payload = String.format(Locale.US,
            "{\"op\":\"publish\",\"topic\":\"%s\",\"msg\":{" +
            "\"header\":{\"stamp\":{\"sec\":0,\"nanosec\":0},\"frame_id\":\"map\"}," +
            "\"pose\":{\"position\":{\"x\":%f,\"y\":%f,\"z\":0.0}," +
            "\"orientation\":{\"x\":0.0,\"y\":0.0,\"z\":%f,\"w\":%f}}}}",
            topic, x, y, oz, ow
        );
        session.sendMessage(new TextMessage(payload));
        logger.info("Published goal for robot " + id + " → (" + x + ", " + y + ", yaw=" + yaw + ")");
    }
}
