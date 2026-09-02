package com.dishpatch.service;

import com.dishpatch.model.Robot;
import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.google.gson.reflect.TypeToken;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.stereotype.Controller;


import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.logging.Logger;

@Controller //Change to @service when @MessageMapping is moved
public class RobotService {

    private static final Logger logger = Logger.getLogger(RobotService.class.getName());

    /**
     * Robot status values. These are a contract with the control frontend — see
     * RobotStatus in control-frontend/src/types/Robot.ts, which drives the map
     * colours and the status cards. A value outside this set renders unstyled.
     */
    public static final String STATUS_SERVING = "Serving";
    public static final String STATUS_PICKUP = "Pickup";
    public static final String STATUS_RETURNING = "Returning";
    public static final String STATUS_WAITING = "Waiting";
    public static final String STATUS_MAINTENANCE = "Maintenance";

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    private final List<Robot> robots = new ArrayList<>();
    private final Map<Integer, Long> robotLastUpdMap = new HashMap<>();
    // Concurrent: written by the rosbridge thread and the dispatch scheduler, and
    // read by the broker thread that serialises it.
    private final Map<String, Object> stats = new ConcurrentHashMap<>();
    private final Gson gson = new Gson();

    private static final long EXPIRY_MILLIS = 20_000L; // 20 seconds
    private static final long BROADCAST_INTERVAL_MS = 100L;

    @MessageMapping("/robot-data") // Temporary Placement. Should have a dedicated file for managing mappings
    private void manageIncomingData(@Payload List<Robot> updatedRobots) {
        logger.info("Received from websocket: " + updatedRobots);
            synchronized (robots) {
                for (Robot incomingRobot : updatedRobots){
                    Optional<Robot> existingRobot = robots.stream()
                            .filter(r -> r.getId() == incomingRobot.getId())
                            .findFirst();

                    if (existingRobot.isPresent()) {
                        Robot robot = existingRobot.get();
                        robot.setX(incomingRobot.getX());
                        robot.setY(incomingRobot.getY());
                        robot.setYaw(incomingRobot.getYaw());
                        robot.setStatus(incomingRobot.getStatus());
                        robot.setBattery(incomingRobot.getBattery());
                        robot.setSpeed(incomingRobot.getSpeed());
                    } else {
                        robots.add(incomingRobot);
                    }
                    // Update last update time
                    robotLastUpdMap.put(incomingRobot.getId(), System.currentTimeMillis());
                }
            }
        }

    // Sort robots by status and filter out expired ones
    private List<Robot> getRobotsSortedByStatus() {
        long currentTime = System.currentTimeMillis();
        synchronized (robots) {
            List<Robot> validRobots = new ArrayList<>();
            for (Robot r : robots) {
                Long lastUpdate = robotLastUpdMap.get(r.getId());
                if (lastUpdate != null && (currentTime - lastUpdate) < EXPIRY_MILLIS) {
                    validRobots.add(r);
                }
            }

            validRobots.sort(Comparator.comparingInt(r -> {
                switch (r.getStatus()) {
                    case STATUS_SERVING: return 0;
                    case STATUS_PICKUP: return 1;
                    case STATUS_RETURNING: return 2;
                    case STATUS_WAITING: return 3;
                    case STATUS_MAINTENANCE: return 4;
                    default: return 5; // Unknown status
                }
            }));
            return validRobots;
        }
    }

    private void updateStats() {
        long serving, pickup, returning, waiting, maintenance;
        int total;

        // Held while counting: the dispatch scheduler mutates statuses while the
        // rosbridge thread adds robots, so an unguarded stream can throw.
        synchronized (robots) {
            serving = robots.stream().filter(r -> STATUS_SERVING.equals(r.getStatus())).count();
            pickup = robots.stream().filter(r -> STATUS_PICKUP.equals(r.getStatus())).count();
            returning = robots.stream().filter(r -> STATUS_RETURNING.equals(r.getStatus())).count();
            waiting = robots.stream().filter(r -> STATUS_WAITING.equals(r.getStatus())).count();
            maintenance = robots.stream().filter(r -> STATUS_MAINTENANCE.equals(r.getStatus())).count();
            total = robots.size();
        }

        stats.put("serving", serving);
        stats.put("pickup", pickup);
        stats.put("returning", returning);
        stats.put("waiting", waiting);
        stats.put("maintenance", maintenance);
        stats.put("total", total);
        stats.put("timestamp", new Date());
    }

    /** Pushes the current robot list and stats to the control frontend. */
    private void broadcast() {
        messagingTemplate.convertAndSend("/topic/robot-locations", getRobotsSortedByStatus());
        messagingTemplate.convertAndSend("/topic/robot-stats", stats);
    }

    /**
     * Pushes the fleet to the control frontend on a fixed tick.
     */
    @Scheduled(fixedDelay = BROADCAST_INTERVAL_MS)
    public void broadcastRobots() {
        try {
            updateStats();
            broadcast();
        } catch (RuntimeException exception) {
            logger.warning("Robot broadcast failed: " + exception);
        }
    }

    /**
     * Updates a single field of a robot from a rosbridge message.
     * If the robot does not exist, it is created with the given id.
     *
     * @param id    robot ID extracted from the ROS2 topic name
     * @param field topic field name: "status", "position", or "battery"
     * @param msg   rosbridge message payload as a JsonObject
     */
    public void updateField(int id, String field, JsonObject msg) {
        synchronized (robots) {
            Robot robot = robots.stream()
                    .filter(r -> r.getId() == id)
                    .findFirst()
                    .orElseGet(() -> {
                        Robot nr = new Robot();
                        nr.setId(id);
                        nr.setName("Robot " + id);
                        nr.setStatus("Waiting"); // Possibly Change
                        robots.add(nr);
                        return nr;
                    });

            switch (field) {
                case "battery" -> robot.setBattery(msg.get("data").getAsInt());
                case "status" -> {
                    robot.setBattery(msg.get("battery").getAsInt());
                    robot.setSpeed(msg.get("speed").getAsFloat());
                    robot.setX(msg.getAsJsonObject("pose").getAsJsonObject("position").get("x").getAsDouble());
                    robot.setY(msg.getAsJsonObject("pose").getAsJsonObject("position").get("y").getAsDouble());

                    // The fleet is planar, so x and y of the quaternion are always
                    // zero and this recovers the heading exactly.
                    JsonObject orientation =
                            msg.getAsJsonObject("pose").getAsJsonObject("orientation");
                    robot.setYaw(2.0 * Math.atan2(
                            orientation.get("z").getAsDouble(),
                            orientation.get("w").getAsDouble()
                    ));
                }
                // Add logic for updating z, speed, status, etc when its possible
            }
            robotLastUpdMap.put(id, System.currentTimeMillis());
        }
    }

    /**
     * Records what the dispatcher has given a robot to do. Set in one call because
     * they always change together — a robot that starts Serving is by definition
     * carrying something somewhere. The write reaches the frontend on the next
     * {@link #broadcastRobots()} tick rather than immediately.
     * <p>
     * Unknown ids are ignored — a robot that has not reported yet has nothing to set.
     *
     * @param id          robot id
     * @param status      one of the {@code STATUS_*} constants
     * @param destination drop point id it is driving to, or null when it is idle
     * @param orderId     order it is carrying, or null when empty-handed
     */
    public void setAssignment(
            int id,
            String status,
            String destination,
            String orderId
    ) {
        synchronized (robots) {
            robots.stream()
                    .filter(r -> r.getId() == id)
                    .findFirst()
                    .ifPresent(robot -> {
                        robot.setStatus(status);
                        robot.setDestination(destination);
                        robot.setOrderId(orderId);
                    });
        }
    }

    /**
     * Ids of robots whose telemetry is still current, using the same expiry as the
     * list pushed to the frontend. Anything else has gone silent and must not be
     * handed new work.
     */
    public List<Integer> getFreshRobotIds() {
        long currentTime = System.currentTimeMillis();

        synchronized (robots) {
            List<Integer> fresh = new ArrayList<>();
            for (Robot robot : robots) {
                if (isFreshAt(robot.getId(), currentTime)) {
                    fresh.add(robot.getId());
                }
            }
            return fresh;
        }
    }

    /**
     * Snapshot of a robot's last reported position.
     * <p>
     * Numerically in the map frame: nav_node seeds its odometry from the robot's
     * INITIAL_X/INITIAL_Y, which are map coordinates, so these compare directly
     * against drop points. RobotStatus carries no frame_id, so that is a
     * convention of the fleet rather than a guarantee.
     */
    public record Position(double x, double y) { }

    /** Last reported position of a robot, empty if it has never reported. */
    public Optional<Position> getPosition(int id) {
        synchronized (robots) {
            return robots.stream()
                    .filter(r -> r.getId() == id)
                    .findFirst()
                    .map(robot -> new Position(robot.getX(), robot.getY()));
        }
    }

    /** Whether this robot has reported telemetry within the expiry window. */
    public boolean isFresh(int id) {
        synchronized (robots) {
            return isFreshAt(id, System.currentTimeMillis());
        }
    }

    /** Package-private so RobotServiceTest can exercise the window without waiting 20s. */
    boolean isFreshAt(int id, long currentTime) {
        Long lastUpdate = robotLastUpdMap.get(id);
        return lastUpdate != null && (currentTime - lastUpdate) < EXPIRY_MILLIS;
    }

    public List<Robot> getAllRobots() {
        return robots;
    }

    public Map<String, Object> getStats() {
        return stats;
    }
}
