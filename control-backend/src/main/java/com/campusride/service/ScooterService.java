package com.campusride.service;

import com.campusride.model.Scooter;
import com.google.gson.Gson;
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
public class ScooterService {

    private static final Logger logger = Logger.getLogger(ScooterService.class.getName());

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    private final List<Scooter> scooters = new ArrayList<>();
    private final Map<Integer, Long> scooterLastUpdMap = new HashMap<>();
    private final Map<String, Object> stats = new HashMap<>();
    private final Gson gson = new Gson();

    private static final long EXPIRY_MILLIS = 20_000L; // 20 seconds

    @MessageMapping("/robot-data") // Temporary Placement. Should have a dedicated file for managing mappings
    private void manageIncomingData(@Payload List<Scooter> updatedScooters) {
        logger.info("Received from websocket: " + updatedScooters);
            synchronized (scooters) {
                for (Scooter incomingScooter : updatedScooters){
                    Optional<Scooter> existingScooter = scooters.stream()
                            .filter(s -> s.getId() == incomingScooter.getId())
                            .findFirst();

                    if (existingScooter.isPresent()) {
                        Scooter scooter = existingScooter.get();
                        scooter.setX(incomingScooter.getX());
                        scooter.setY(incomingScooter.getY());
                        scooter.setStatus(incomingScooter.getStatus());
                        scooter.setBattery(incomingScooter.getBattery());
                        scooter.setSpeed(incomingScooter.getSpeed());
                    } else {
                        scooters.add(incomingScooter);
                    }
                    // Update last update time
                    scooterLastUpdMap.put(incomingScooter.getId(), System.currentTimeMillis());
                }
            }

            updateStats();
            messagingTemplate.convertAndSend("/topic/scooter-locations", getScootersSortedByStatus());
            messagingTemplate.convertAndSend("/topic/scooter-stats", stats);
        }

    // Sort scooters by status and filter out expired ones
    private List<Scooter> getScootersSortedByStatus() {
        long currentTime = System.currentTimeMillis();
        synchronized (scooters) {
            List<Scooter> validScooters = new ArrayList<>();
            for (Scooter s : scooters) {
                Long lastUpdate = scooterLastUpdMap.get(s.getId());
                if (lastUpdate != null && (currentTime - lastUpdate) < EXPIRY_MILLIS) {
                    validScooters.add(s);
                }
            }

            validScooters.sort(Comparator.comparingInt(s -> {
                switch (s.getStatus()) {
                    case "Serving": return 0;
                    case "Pickup": return 1;
                    case "Returning": return 2;
                    case "Waiting": return 3;
                    case "Maintenance": return 4;
                    default: return 5; // Unknown status
                }
            }));
            return validScooters;
        }
    }

    private void updateStats() {
        long serving = scooters.stream().filter(s -> "Serving".equals(s.getStatus())).count();
        long pickup = scooters.stream().filter(s -> "Pickup".equals(s.getStatus())).count();
        long returning = scooters.stream().filter(s -> "Returning".equals(s.getStatus())).count();
        long waiting = scooters.stream().filter(s -> "Waiting".equals(s.getStatus())).count();
        long maintenance = scooters.stream().filter(s -> "Maintenance".equals(s.getStatus())).count();
        int total = scooters.size();

        stats.put("serving", serving);
        stats.put("pickup", pickup);
        stats.put("returning", returning);
        stats.put("waiting", waiting);
        stats.put("maintenance", maintenance);
        stats.put("total", total);
        stats.put("timestamp", new Date());
    }

    public List<Scooter> getAllScooters() {
        return scooters;
    }

    public Map<String, Object> getStats() {
        return stats;
    }
}