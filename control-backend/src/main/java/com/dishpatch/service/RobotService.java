package com.dishpatch.service;

import com.dishpatch.model.Robot;
import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.google.gson.reflect.TypeToken;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.stereotype.Controller;


import java.util.*;
import java.util.logging.Logger;

@Controller //Change to @service when @MessageMapping is moved
public class RobotService {

    private static final Logger logger = Logger.getLogger(RobotService.class.getName());

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    private final List<Robot> robots = new ArrayList<>();
    private final Map<Integer, Long> robotLastUpdMap = new HashMap<>();
    private final Map<String, Object> stats = new HashMap<>();
    private final Gson gson = new Gson();

    private static final long EXPIRY_MILLIS = 20_000L; // 20 seconds

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

            updateStats();
            messagingTemplate.convertAndSend("/topic/robot-locations", getRobotsSortedByStatus());
            messagingTemplate.convertAndSend("/topic/robot-stats", stats);
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
                    case "Serving": return 0;
                    case "Pickup": return 1;
                    case "Returning": return 2;
                    case "Waiting": return 3;
                    case "Maintenance": return 4;
                    default: return 5; // Unknown status
                }
            }));
            return validRobots;
        }
    }

    private void updateStats() {
        long serving = robots.stream().filter(r -> "Serving".equals(r.getStatus())).count();
        long pickup = robots.stream().filter(r -> "Pickup".equals(r.getStatus())).count();
        long returning = robots.stream().filter(r -> "Returning".equals(r.getStatus())).count();
        long waiting = robots.stream().filter(r -> "Waiting".equals(r.getStatus())).count();
        long maintenance = robots.stream().filter(r -> "Maintenance".equals(r.getStatus())).count();
        int total = robots.size();

        stats.put("serving", serving);
        stats.put("pickup", pickup);
        stats.put("returning", returning);
        stats.put("waiting", waiting);
        stats.put("maintenance", maintenance);
        stats.put("total", total);
        stats.put("timestamp", new Date());
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
                }
                // Add logic for updating z, speed, status, etc when its possible
            }
            robotLastUpdMap.put(id, System.currentTimeMillis());
        }

        updateStats();
        messagingTemplate.convertAndSend("/topic/robot-locations", getRobotsSortedByStatus());
        messagingTemplate.convertAndSend("/topic/robot-stats", stats);
    }

    public List<Robot> getAllRobots() {
        return robots;
    }

    public Map<String, Object> getStats() {
        return stats;
    }
}
