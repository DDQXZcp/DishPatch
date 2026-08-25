package com.dishpatch.service;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import jakarta.annotation.PostConstruct;
import jakarta.websocket.ContainerProvider;
import jakarta.websocket.WebSocketContainer;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import org.springframework.web.socket.CloseStatus;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.logging.Logger;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Connects to rosbridge as a WebSocket client to exchange ROS2 topics with the
 * robot fleet.
 *
 * The fleet size is not configured. rosbridge is asked what is on the ROS graph
 * (via the {@code /rosapi/topics} service) and every {@code /robot{id}/status}
 * topic it reports becomes a robot this backend follows — so robots that boot
 * after the backend are picked up on the next discovery pass.
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

    @Value("${rosbridge.url}")
    private String rosbridgeUrl;

    @Autowired
    private RobotService robotService;

    /**
     * Written on the WebSocket container's callback thread, read from the scheduler
     * thread, the dispatch tick and the retry loop — so it is volatile. A stale read
     * here is a wrong answer to "is the fleet link up".
     */
    private volatile WebSocketSession session;

    /**
     * Guards writes to the session. rosbridge messages are sent from the
     * rosbridge thread, the discovery pass and the dispatch scheduler, and a
     * WebSocket session rejects a second write while one is still in flight.
     */
    private final Object sendLock = new Object();

    /** Hidden topic the NavigateToPose action server publishes its goal states on. */
    private static final String NAV_STATUS_SUFFIX = "/navigate_to_pose/_action/status";

    /** rosapi service listing every topic currently on the ROS graph. */
    private static final String TOPICS_SERVICE = "/rosapi/topics";

    /** Tags our own {@link #TOPICS_SERVICE} calls, so the responses are ours to read. */
    private static final String DISCOVERY_ID = "dishpatch-robot-discovery";

    /** How often the fleet is re-checked for robots that have since come online. */
    private static final long DISCOVERY_INTERVAL_MS = 10_000;

    /** A robot exists, as far as this backend is concerned, when it publishes this. */
    private static final Pattern STATUS_TOPIC = Pattern.compile("^/robot(\\d+)/status$");

    /** Assumed status type when rosapi reports a topic without one. */
    private static final String STATUS_TYPE = "shared_msgs/msg/RobotStatus";

    // action_msgs/msg/GoalStatus codes. ACCEPTED and EXECUTING mean Nav2 is still
    // driving; the rest are terminal. SUCCEEDED is not the same news as ABORTED,
    // and this class used to discard that difference — see lastGoalFailed.
    private static final int GOAL_ACCEPTED = 1;
    private static final int GOAL_EXECUTING = 2;
    private static final int GOAL_CANCELED = 5;
    private static final int GOAL_ABORTED = 6;

    /** Whether Nav2 currently holds a live goal, per robot id. */
    private final Map<Integer, Boolean> navigating = new ConcurrentHashMap<>();

    /**
     * Robots discovered and subscribed to on this session, so each is set up once.
     * <p>
     * Nothing is ever removed: a robot that dies keeps its status topic on the
     * graph for as long as we subscribe to it, so its disappearance is not
     * visible here. RobotService's telemetry expiry is what marks it gone.
     */
    private final Set<Integer> followed = ConcurrentHashMap.newKeySet();

    /**
     * Status of the most recently seen goal, per robot id.
     * <p>
     * Kept because "Nav2 is idle" answers a different question from "Nav2 gave up".
     * On 2026-08-11 two robots were stranded by aborted goals whose ABORTED status
     * arrived here, was parsed, and was collapsed into {@link #navigating} — the one
     * piece of news that would have identified the failure was discarded a line
     * before it became useful.
     */
    private final Map<Integer, Integer> lastGoalStatus = new ConcurrentHashMap<>();

    /**
     * Largest rosbridge frame this client will accept.
     * <p>
     * The container default is 8192, which is not enough. The latched Nav2 goal
     * status array carries every goal the action server still retains, at roughly
     * 122 bytes each, and a busy spell pushes it past 8192. A frame over the limit
     * closes the session with 1009 rather than being truncated, and because the
     * topic is latched the same frame arrives again on every reconnect — so the link
     * stays down until the array drains rather than recovering on its own.
     */
    private static final int MAX_TEXT_MESSAGE_BYTES = 1024 * 1024;

    private final StandardWebSocketClient client = createClient();

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

    /** How long one handshake gets before it is abandoned and retried. */
    private static final long HANDSHAKE_TIMEOUT_MS = 10_000;

    /** Delay between connection attempts. */
    private long retryDelayMs = 5_000;

    /**
     * True while a retry loop is running.
     * <p>
     * {@link #afterConnectionClosed} calls {@link #connect()}, which can arrive while a
     * loop is already sleeping between attempts.
     */
    private final AtomicBoolean connecting = new AtomicBoolean();

    /**
     * Connects to rosbridge, retrying every {@link #retryDelayMs} until it succeeds.
     * <p>
     * Runs on its own thread rather than a {@code @Scheduled} tick because the wait
     * below blocks: {@code @EnableScheduling} binds to the STOMP broker's TaskScheduler,
     * shared with the dashboard pushes and the dispatch tick, and blocking there stalls
     * both.
     */
    @PostConstruct
    public void connect() {
        if (!connecting.compareAndSet(false, true)) {
            return; // a loop is already retrying; a second would race it for the session
        }

        new Thread(() -> {
            try {
                while (!isConnected()) {
                    try {
                        logger.info("RosBridgeService connecting to " + rosbridgeUrl);

                        // The result has to be waited on. execute() hands the handshake
                        // to another thread and reports a refused connection by
                        // completing this future exceptionally — it does not throw here.
                        openSession().get(HANDSHAKE_TIMEOUT_MS, TimeUnit.MILLISECONDS);
                        return;
                    } catch (ExecutionException | TimeoutException e) {
                        logger.warning("Failed to connect to rosbridge, retrying in "
                                + retryDelayMs + "ms: " + e.getMessage());
                    }

                    Thread.sleep(retryDelayMs);
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            } finally {
                connecting.set(false);
            }
        }, "rosbridge-connect").start();
    }

    /**
     * Opens one session.
     * <p>
     * The only line that touches the network, kept overridable so the retry loop can be
     * tested without a rosbridge.
     */
    protected CompletableFuture<WebSocketSession> openSession() {
        return client.execute(this, rosbridgeUrl);
    }

    /** Test seam: shortens the backoff so the retry loop can be exercised quickly. */
    void setRetryDelayMs(long retryDelayMs) {
        this.retryDelayMs = retryDelayMs;
    }

    /**
     * Called when the WebSocket connection to rosbridge is established.
     * <p>
     * Nothing is subscribed here — which robots exist is a question for the ROS
     * graph, so the session starts empty and asks.
     */
    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        this.session = session;

        followed.clear();

        // New session — nothing known about Nav2 yet. Stale goal outcomes are worse
        // than none: they would describe goals from before the link dropped.
        navigating.clear();
        lastGoalStatus.clear();
        logger.info("Connected to rosbridge at " + rosbridgeUrl);
        discoverRobots();
    }

    /**
     * Asks rosbridge which topics exist, so the fleet does not have to be
     * configured. The answer arrives asynchronously — see {@link #adoptRobots}.
     * <p>
     * Runs on a timer as well as at connection time: a robot container started
     * later joins the graph without any event reaching us, and only shows up on
     * a later pass.
     */
    @Scheduled(fixedDelay = DISCOVERY_INTERVAL_MS)
    public void discoverRobots() {
        if (!isConnected()) {
            return; // nothing to ask, and the reconnect will discover on arrival
        }

        try {
            send(String.format(
                "{\"op\":\"call_service\",\"id\":\"%s\",\"service\":\"%s\",\"args\":{}}",
                DISCOVERY_ID, TOPICS_SERVICE
            ));
        } catch (Exception e) {
            logger.warning("Failed to ask rosbridge for the topic list: " + e.getMessage());
        }
    }

    /**
     * Called on each incoming message from rosbridge.
     * Routes discovery results and Nav2 goal status, and forwards everything else
     * to RobotService.updateField().
     */
    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        try {
            JsonObject json = JsonParser.parseString(message.getPayload()).getAsJsonObject();

            String op = json.get("op").getAsString();

            if ("service_response".equals(op)) {
                handleServiceResponse(json);
                return;
            }

            if (!"publish".equals(op)) return;

            String     topic = json.get("topic").getAsString();
            JsonObject msg   = json.getAsJsonObject("msg");

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
     * Reads the answer to a {@link #TOPICS_SERVICE} call.
     * <p>
     * Responses to anything else are ignored, and a failed call is logged rather
     * than retried here — the next discovery pass is the retry.
     */
    private void handleServiceResponse(JsonObject json) throws Exception {
        JsonElement id = json.get("id");

        if (id == null || !id.isJsonPrimitive()
                || !DISCOVERY_ID.equals(id.getAsString())) {
            return;
        }

        JsonElement result = json.get("result");
        JsonElement values = json.get("values");

        // rosbridge answers a failed call with result:false and the error text in
        // values, so the payload is not the object the success case returns.
        if ((result != null && !result.getAsBoolean())
                || values == null
                || !values.isJsonObject()) {
            logger.warning("Robot discovery failed — is rosapi running? " + values);
            return;
        }

        adoptRobots(values.getAsJsonObject());
    }

    /**
     * Turns a rosapi topic list into subscriptions.
     * <p>
     * Every {@code /robot{id}/status} on the graph is a robot, and each one is
     * only set up the first time it is seen, so re-running this is free.
     *
     * @param values rosapi_msgs/Topics response: parallel "topics" and "types" arrays
     */
    private void adoptRobots(JsonObject values) throws Exception {
        JsonArray topics = values.getAsJsonArray("topics");

        if (topics == null) return;

        JsonArray types = values.getAsJsonArray("types");
        List<Integer> discovered = new ArrayList<>();

        for (int i = 0; i < topics.size(); i++) {
            Matcher matcher = STATUS_TOPIC.matcher(topics.get(i).getAsString());

            if (!matcher.matches()) continue;

            // Take the type the graph reports rather than assuming it: a robot
            // publishing something else is a mismatch worth failing loudly on.
            String type = (types != null && i < types.size())
                    ? types.get(i).getAsString()
                    : STATUS_TYPE;

            int id = Integer.parseInt(matcher.group(1));

            if (followRobot(id, type)) {
                discovered.add(id);
            }
        }

        if (!discovered.isEmpty()) {
            logger.info("Discovered robots " + discovered
                    + " — now following " + followed.size() + " robot(s)");
        }
    }

    /**
     * Subscribes to one robot's topics and advertises its goal topic.
     *
     * @return true when this robot was new, false when it was already followed
     */
    private boolean followRobot(int id, String statusType) throws Exception {
        if (!followed.add(id)) return false;

        try {
            subscribe("/robot" + id + "/status", statusType);
            subscribe("/robot" + id + NAV_STATUS_SUFFIX, "action_msgs/msg/GoalStatusArray");

            // Advertised up front, not on first publish. A freshly advertised
            // publisher has to discover goal_relay_node's subscription, and
            // anything published before that completes is dropped silently.
            advertiseGoal(id);
            return true;

        } catch (Exception e) {
            // Half set up is worse than not set up: drop it so the next
            // discovery pass tries again.
            followed.remove(id);
            throw e;
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
        Integer latest = null;

        // No early exit: the loop has to reach the end of the array to read the
        // newest goal. The action server appends, so the last entry is the newest.
        for (JsonElement element : msg.getAsJsonArray("status_list")) {
            int status = element.getAsJsonObject().get("status").getAsInt();
            latest = status;

            if (status == GOAL_ACCEPTED || status == GOAL_EXECUTING) {
                active = true;
            }
        }

        navigating.put(id, active);

        if (latest != null) {
            lastGoalStatus.put(id, latest);
        }
    }

    /**
     * Called when the rosbridge connection is closed. Hands straight back to
     * {@link #connect()}, which retries until the link is back.
     */
    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        logger.warning("Rosbridge disconnected (" + status + "). Reconnecting...");
        connect();
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
        send(payload);
    }

    /** Advertises a robot's goal_pose topic, so later publishes are not dropped. */
    private void advertiseGoal(int id) throws Exception {
        send(String.format(
            "{\"op\":\"advertise\",\"topic\":\"/robot%d/goal_pose\",\"type\":\"geometry_msgs/PoseStamped\"}", id
        ));
    }

    /** Sends one rosbridge message; serialised, since a session takes one write at a time. */
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
     * Robot ids found on the ROS graph and subscribed to, ascending.
     * <p>
     * The fleet as rosbridge reports it, which is not the same as the fleet that
     * is alive — see {@link RobotService#getFreshRobotIds()} for that.
     */
    public List<Integer> followedRobotIds() {
        return followed.stream().sorted().toList();
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
     * Whether the most recent goal Nav2 reported for this robot ended in failure
     * rather than success.
     * <p>
     * Only meaningful while {@link #isNavigating} is false — a live goal has no
     * outcome yet. Read together they separate "still driving" from "arrived" from
     * "gave up", which is the distinction the dispatcher needs to decide whether to
     * wait, advance, or re-send.
     * <p>
     * False also means "not known yet", so a caller must not treat it as proof the
     * last goal succeeded. It is an accelerator for the common case, not the only
     * thing standing between a lost goal and a stranded robot.
     */
    public boolean lastGoalFailed(int robotId) {
        Integer status = lastGoalStatus.get(robotId);
        return status != null
                && (status == GOAL_ABORTED || status == GOAL_CANCELED);
    }

    /**
     * Publishes a navigation goal to {@code /robot{id}/goal_pose} via rosbridge.
     * The topic is advertised at connection time, not here.
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
