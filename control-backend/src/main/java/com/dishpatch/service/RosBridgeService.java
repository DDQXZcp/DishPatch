package com.dishpatch.service;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
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
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Connects to rosbridge as a WebSocket client to exchange ROS2 topics with the
 * robot fleet.
 *
 * Robots are discovered, not configured. Every {@value #DISCOVERY_INTERVAL_MS}ms
 * the service asks rosapi for the live topic list and subscribes to any
 * /robot{id}/status topic it has not seen yet, so robots that come up after the
 * backend — or long after it — are picked up without a restart or a config change.
 *
 * Subscribes (per discovered robot id):
 *   /robot{id}/status    shared_msgs/msg/RobotStatus   (robot_id, battery, speed, sensor, pose)
 *
 * Publishes (on demand, via {@link #publishGoal}):
 *   /robot{id}/goal_pose geometry_msgs/PoseStamped     navigation goal in the "map" frame
 *
 * Configure in application.properties:
 *   rosbridge.url=ws://<IP>:9090
 */
@Service
public class RosBridgeService extends TextWebSocketHandler {

    private static final Logger logger = Logger.getLogger(RosBridgeService.class.getName());

    /** How often the live topic list is re-polled to pick up newly started robots. */
    static final int DISCOVERY_INTERVAL_MS = 10_000;

    /** Correlates our rosapi replies; other service responses are ignored. */
    private static final String DISCOVERY_REQUEST_ID = "dishpatch-robot-discovery";

    /**
     * Matches only the status topic, so each robot is counted once — the topic
     * list also contains /robot{id}/odom, /robot{id}/cmd_vel and friends.
     * The captured group is the robot id used throughout the backend.
     */
    private static final Pattern STATUS_TOPIC = Pattern.compile("^/robot(\\d+)/status$");

    @Value("${rosbridge.url}")
    private String rosbridgeUrl;

    @Autowired
    private ScooterService scooterService;

    private WebSocketSession session;

    /** Robot ids whose goal_pose topic has been advertised on the current session. */
    private final Set<Integer> advertisedGoals = ConcurrentHashMap.newKeySet();

    /** Robot ids already subscribed on the current session, to avoid duplicate subscribes. */
    private final Set<Integer> subscribedRobots = ConcurrentHashMap.newKeySet();

    /** Guards writes to {@link #session}; see {@link #send(String)}. */
    private final Object sendLock = new Object();

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
     * Kicks off robot discovery; the scheduled poll takes over from here.
     */
    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        this.session = session;
        // New session — subscriptions and advertisements from the old one are gone.
        advertisedGoals.clear();
        subscribedRobots.clear();
        logger.info("Connected to rosbridge at " + rosbridgeUrl);

        requestTopicList();
    }

    /**
     * Asks rosapi for the live topic list so newly started robots get picked up.
     *
     * Polling rather than a one-shot query at connect time is what makes startup
     * order irrelevant: if the backend wins the race against the robot containers
     * the first reply is simply empty, and the next one finds them.
     */
    @Scheduled(fixedDelay = DISCOVERY_INTERVAL_MS, initialDelay = DISCOVERY_INTERVAL_MS)
    public void discoverRobots() {
        if (!isConnected()) return;
        try {
            requestTopicList();
        } catch (Exception e) {
            logger.warning("Robot discovery poll failed: " + e.getMessage());
        }
    }

    /** Sends the /rosapi/topics service call. The reply arrives in handleTextMessage. */
    private void requestTopicList() throws Exception {
        send(String.format(
            "{\"op\":\"call_service\",\"id\":\"%s\",\"service\":\"/rosapi/topics\"}",
            DISCOVERY_REQUEST_ID
        ));
    }

    /**
     * Subscribes to every /robot{id}/status topic not already subscribed on this
     * session. Robots that vanish keep their subscription: DDS reattaches on its
     * own if the container comes back, and ScooterService already drops stale
     * robots from the dashboard after its own expiry window.
     */
    private void handleTopicListResponse(JsonObject json) {
        if (!DISCOVERY_REQUEST_ID.equals(optString(json, "id"))) return;

        JsonObject values = json.getAsJsonObject("values");
        if (values == null || !values.has("topics")) {
            logger.warning("rosapi topic list response carried no topics — is rosapi running?");
            return;
        }

        JsonArray topics = values.getAsJsonArray("topics");
        for (JsonElement element : topics) {
            Matcher matcher = STATUS_TOPIC.matcher(element.getAsString());
            if (!matcher.matches()) continue;

            int id = Integer.parseInt(matcher.group(1));
            if (!subscribedRobots.add(id)) continue; // already subscribed this session

            try {
                subscribe("/robot" + id + "/status", "shared_msgs/msg/RobotStatus");
                logger.info("Discovered robot " + id + " — subscribed to /robot" + id + "/status");
            } catch (Exception e) {
                subscribedRobots.remove(id); // let the next poll retry
                logger.warning("Failed to subscribe to robot " + id + ": " + e.getMessage());
            }
        }
    }

    /** Reads a string member, returning null when absent — rosbridge omits optional fields. */
    private static String optString(JsonObject json, String member) {
        JsonElement value = json.get(member);
        return value == null || value.isJsonNull() ? null : value.getAsString();
    }

    /**
     * Called on each incoming message from rosbridge.
     * Parses the topic and field, then forwards to ScooterService.updateField().
     */
    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        try {
            JsonObject json = JsonParser.parseString(message.getPayload()).getAsJsonObject();

            String op = optString(json, "op");

            if ("service_response".equals(op)) {
                handleTopicListResponse(json);
                return;
            }

            if (!"publish".equals(op)) return;

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
        send(String.format(
            "{\"op\":\"subscribe\",\"topic\":\"%s\",\"type\":\"%s\"}", topic, type
        ));
    }

    /**
     * Serialises writes to the socket.
     *
     * WebSocketSession is not safe for concurrent sends, and three threads reach
     * it here: the WebSocket receive thread, the discovery scheduler, and
     * whichever request thread calls {@link #publishGoal}. Interleaved sends
     * corrupt the frame stream and drop the connection.
     */
    private void send(String payload) throws Exception {
        synchronized (sendLock) {
            session.sendMessage(new TextMessage(payload));
        }
    }

    /** True when the rosbridge session is open and goals can actually be sent. */
    public boolean isConnected() {
        return session != null && session.isOpen();
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
            send(String.format(
                "{\"op\":\"advertise\",\"topic\":\"%s\",\"type\":\"geometry_msgs/PoseStamped\"}", topic
            ));
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
        send(payload);
        logger.info("Published goal for robot " + id + " → (" + x + ", " + y + ", yaw=" + yaw + ")");
    }
}
