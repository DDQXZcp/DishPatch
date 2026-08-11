package com.dishpatch.service;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import jakarta.annotation.PostConstruct;
import jakarta.websocket.ContainerProvider;
import jakarta.websocket.WebSocketContainer;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import org.springframework.web.socket.CloseStatus;

import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.logging.Logger;

/**
 * Connects to rosbridge as a WebSocket client to exchange ROS2 topics with the
 * robot fleet.
 *
 * Subscribes (per robot id 1..robotCount):
 *   /robot{id}/status    shared_msgs/msg/RobotStatus   (robot_id, battery, speed, sensor, pose)
 *   /robot{id}/navigate_to_pose/_action/status
 *                        action_msgs/msg/GoalStatusArray  whether Nav2 holds a live goal
 *
 * Publishes (on demand, via {@link #publishGoal}):
 *   /robot{id}/goal_pose geometry_msgs/PoseStamped     navigation goal in the "map" frame
 *
 * The status array is latched and carries every goal the action server still
 * retains, so it is the one subscription whose size follows recent traffic rather
 * than being fixed per message — see {@link #MAX_TEXT_MESSAGE_BYTES}.
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
    private RobotService robotService;

    /**
     * Written on the WebSocket IO thread, read on the dispatch scheduler thread via
     * {@link #isConnected} and {@link #publishGoal}, so the reference has to be
     * published safely.
     */
    private volatile WebSocketSession session;

    /**
     * Largest rosbridge frame this client will accept.
     * <p>
     * The container default is 8192, which is not enough: the Nav2 goal status array
     * carries every goal the action server still retains, at roughly 122 bytes each.
     * Retention is a rolling window, so the array tracks recent traffic rather than
     * climbing forever — but a busy spell overflows 8192 all the same. Observed on
     * this fleet: 68 entries / 8272 bytes at a peak, 10 / 1297 while quiet.
     * <p>
     * That makes the failure intermittent and easy to misread. A frame over the limit
     * closes the session with 1009 instead of being truncated, and because the status
     * topic is latched the same frame arrives again on every reconnect — so once a
     * busy spell pushes it over, the link stays down until the array drains.
     * <p>
     * Headroom only. {@code action_server_result_timeout} on the Nav2 side is what
     * keeps the peak small; see robot-fleet/config/nav2_params_template.yaml.
     */
    private static final int MAX_TEXT_MESSAGE_BYTES = 1024 * 1024;

    /** Warn once a frame passes this, so the next overflow is seen coming. */
    private static final int LARGE_TEXT_MESSAGE_BYTES = MAX_TEXT_MESSAGE_BYTES / 2;

    /**
     * Built once rather than per connection attempt, so the raised buffer limit is
     * applied before the handshake on every reconnect.
     */
    private final StandardWebSocketClient client = createClient();

    /** Hidden topic the NavigateToPose action server publishes its goal states on. */
    private static final String NAV_STATUS_SUFFIX = "/navigate_to_pose/_action/status";

    // action_msgs/msg/GoalStatus codes. The rest (SUCCEEDED, ABORTED, CANCELED)
    // are terminal and mean Nav2 is no longer driving.
    private static final int GOAL_ACCEPTED = 1;
    private static final int GOAL_EXECUTING = 2;

    /** Whether Nav2 currently holds a live goal, per robot id. */
    private final Map<Integer, Boolean> navigating = new ConcurrentHashMap<>();

    /**
     * A client whose container accepts frames up to {@link #MAX_TEXT_MESSAGE_BYTES}.
     * <p>
     * The limit belongs to the container and is read during the handshake, so it has
     * to be set before {@code execute} rather than on the open session.
     */
    private static StandardWebSocketClient createClient() {
        WebSocketContainer container = ContainerProvider.getWebSocketContainer();
        container.setDefaultMaxTextMessageBufferSize(MAX_TEXT_MESSAGE_BYTES);
        return new StandardWebSocketClient(container);
    }

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
                    client.execute(this, rosbridgeUrl);
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
        navigating.clear(); // new session — nothing known about Nav2 yet
        logger.info("Connected to rosbridge at " + rosbridgeUrl);

        for (int i = 1; i <= robotCount; i++) {
            subscribe("/robot" + i + "/status", "shared_msgs/msg/RobotStatus");
            subscribe("/robot" + i + NAV_STATUS_SUFFIX, "action_msgs/msg/GoalStatusArray");

            // Advertised up front, not on first publish. A freshly advertised
            // publisher has to discover goal_relay_node's subscription, and
            // anything published before that completes is dropped silently.
            advertiseGoal(i);
        }

        logger.info("Subscribed and advertised for " + robotCount + " robots.");
    }


    /**
     * Called on each incoming message from rosbridge.
     * Routes Nav2 goal status, and forwards everything else to
     * RobotService.updateField().
     */
    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        try {
            JsonObject json = JsonParser.parseString(message.getPayload()).getAsJsonObject();

            if (!"publish".equals(json.get("op").getAsString())) return;

            String     topic = json.get("topic").getAsString();
            JsonObject msg   = json.getAsJsonObject("msg");

            // A frame that reaches the limit kills the session, and a latched topic
            // will resend it on every reconnect. Naming the topic while it is merely
            // large turns that into something seen coming rather than diagnosed after.
            if (message.getPayloadLength() > LARGE_TEXT_MESSAGE_BYTES) {
                logger.warning(
                        "Large rosbridge frame on " + topic + ": "
                                + message.getPayloadLength() + " bytes, limit "
                                + MAX_TEXT_MESSAGE_BYTES
                );
            }

            // Topic format: /robot{id}/{field}
            String[] parts = topic.split("/"); // ["", "robot1", "field"]
            if (parts.length < 3) return;

            int id = Integer.parseInt(parts[1].replace("robot", ""));

            if (topic.endsWith(NAV_STATUS_SUFFIX)) {
                updateNavigating(id, msg);
                return;
            }

            robotService.updateField(id, parts[2], msg);

        } catch (Exception e) {
            logger.warning("Error handling rosbridge message: " + e.getMessage());
        }
    }

    /**
     * Records whether Nav2 currently holds a live goal for this robot.
     * <p>
     * The status array keeps terminal goals too, so a robot is only considered to
     * be navigating while at least one goal is ACCEPTED or EXECUTING.
     */
    private void updateNavigating(int id, JsonObject msg) {
        boolean active = false;

        for (JsonElement element : msg.getAsJsonArray("status_list")) {
            int status = element.getAsJsonObject().get("status").getAsInt();

            if (status == GOAL_ACCEPTED || status == GOAL_EXECUTING) {
                active = true;
                break;
            }
        }

        navigating.put(id, active);
    }

    /**
     * Called when the rosbridge connection is closed.
     * Waits 5 seconds then attempts to reconnect.
     */
    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        logger.warning("Rosbridge disconnected (" + status + "). Reconnecting in 5s...");

        // The oversized frame is never delivered, so its size cannot be logged here.
        // Say what the limit was and what to look at instead — reconnecting will not
        // help if the peer is latching a frame this client cannot accept.
        if (status.getCode() == CloseStatus.TOO_BIG_TO_PROCESS.getCode()) {
            logger.warning(
                    "Disconnect was a frame over the " + MAX_TEXT_MESSAGE_BYTES
                            + " byte limit. A latched topic will resend it on every"
                            + " reconnect; check the Nav2 goal status array size and"
                            + " action_server_result_timeout."
            );
        }

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

    /** Advertises a robot's goal_pose topic, so later publishes are not dropped. */
    private void advertiseGoal(int id) throws Exception {
        session.sendMessage(new TextMessage(String.format(
            "{\"op\":\"advertise\",\"topic\":\"/robot%d/goal_pose\",\"type\":\"geometry_msgs/PoseStamped\"}", id
        )));
    }

    /**
     * True when the rosbridge session is open.
     * <p>
     * Says the link was up when asked, not that anything sent over it arrives — the
     * session can close between this returning true and the next write.
     */
    public boolean isConnected() {
        WebSocketSession current = session; // one read: the IO thread can replace it
        return current != null && current.isOpen();
    }

    /**
     * Whether Nav2 currently holds a live goal for this robot, from the action
     * server's own status topic.
     * <p>
     * False also means "not known yet" — before the first status message arrives
     * there is nothing to report, and treating that as idle lets a goal be sent.
     */
    public boolean isNavigating(int robotId) {
        return Boolean.TRUE.equals(navigating.get(robotId));
    }

    /**
     * Publishes a navigation goal to {@code /robot{id}/goal_pose} via rosbridge.
     * The topic is advertised at connection time, not here.
     *
     * @param id  robot id (matches the {@code /robot{id}} namespace)
     * @param x   goal X in the "map" frame
     * @param y   goal Y in the "map" frame
     * @param yaw goal heading in radians (0 = facing +X); converted to a 2D quaternion
     * @return true when the goal was written to an open session. Not a delivery
     *         receipt: a session that closes immediately afterwards takes the goal
     *         with it, and rosbridge does not acknowledge publishes. Nav2's own
     *         status topic is the only proof the goal landed, which is why a driving
     *         stage that shows no live goal re-sends rather than trusting this
     */
    public boolean publishGoal(int id, double x, double y, double yaw) throws Exception {
        // Read once: the field is volatile and the IO thread can null it mid-method.
        WebSocketSession current = session;

        if (current == null || !current.isOpen()) {
            logger.warning("Cannot publish goal for robot " + id + " — rosbridge not connected");
            return false;
        }

        String topic = "/robot" + id + "/goal_pose";

        double oz = Math.sin(yaw / 2.0);
        double ow = Math.cos(yaw / 2.0);

        String payload = String.format(Locale.US,
            "{\"op\":\"publish\",\"topic\":\"%s\",\"msg\":{" +
            "\"header\":{\"stamp\":{\"sec\":0,\"nanosec\":0},\"frame_id\":\"map\"}," +
            "\"pose\":{\"position\":{\"x\":%f,\"y\":%f,\"z\":0.0}," +
            "\"orientation\":{\"x\":0.0,\"y\":0.0,\"z\":%f,\"w\":%f}}}}",
            topic, x, y, oz, ow
        );
        current.sendMessage(new TextMessage(payload));
        logger.info("Published goal for robot " + id + " → (" + x + ", " + y + ", yaw=" + yaw + ")");
        return true;
    }
}
