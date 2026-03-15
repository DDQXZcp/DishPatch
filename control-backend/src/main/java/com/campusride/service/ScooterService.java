package com.campusride.service;

import com.campusride.model.Scooter;
import com.campusride.utils.SSLUtils;
import com.google.gson.Gson;
import com.google.gson.reflect.TypeToken;
import io.github.cdimascio.dotenv.Dotenv;
import org.eclipse.paho.client.mqttv3.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.io.File;
import java.util.*;
import java.util.concurrent.ThreadLocalRandom;
import java.util.logging.Logger;

@Service
public class ScooterService {

    private static final Logger logger = Logger.getLogger(ScooterService.class.getName());

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    private final List<Scooter> scooters = new ArrayList<>();
    private final Map<Integer, Long> scooterLastUpdMap = new HashMap<>();
    private final Map<String, Object> stats = new HashMap<>();
    private final Gson gson = new Gson();

    private static final long EXPIRY_MILLIS = 20_000L; // 20 seconds

    public ScooterService() {
        initializeMQTT();
    }

    private void initializeMQTT() {
        try {
            // Load MQTT credentials from environment variables instead of local .env file
            String broker = "ssl://m178f7c2.ala.asia-southeast1.emqxsl.com:8883";
            String username = System.getenv("MQTT_USERNAME");
            String password = System.getenv("MQTT_PASSWORD");

            if (username == null || password == null) {
                throw new RuntimeException("MQTT_USERNAME or MQTT_PASSWORD environment variables are not set.");
            }

            MqttClient mqttClient = new MqttClient(broker, "backend");
            MqttConnectOptions options = new MqttConnectOptions();
            options.setUserName(username);
            options.setPassword(password.toCharArray());
            options.setSocketFactory(SSLUtils.getSocketFactory("/home/ec2-user/emqxsl-ca.crt"));

            mqttClient.connect(options);
            mqttClient.subscribe("scooter/data", (topic, message) -> {
                String payload = new String(message.getPayload());
                logger.info("Received from MQTT: " + payload);

                List<Scooter> updatedScooters = gson.fromJson(payload, new TypeToken<List<Scooter>>() {}.getType());
                synchronized (scooters) {
                    for (Scooter incomingScooter : updatedScooters){
                        Optional<Scooter> existingScooter = scooters.stream()
                                .filter(s -> s.getId() == incomingScooter.getId())
                                .findFirst();

                        if (existingScooter.isPresent()) {
                            Scooter scooter = existingScooter.get();
                            scooter.setLat(incomingScooter.getLat());
                            scooter.setLng(incomingScooter.getLng());
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
            });
        } catch (Exception e) {
            logger.severe("MQTT connection failed: " + e.getMessage());
        }
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
                    case "Running": return 0;
                    case "Locked": return 1;
                    case "Maintenance": return 2;
                    default: return 3; // Unknown status
                }
            }));
            return validScooters;
        }
    }

    private void updateStats() {
        long running = scooters.stream().filter(s -> "Running".equals(s.getStatus())).count();
        long locked = scooters.stream().filter(s -> "Locked".equals(s.getStatus())).count();
        long maintenance = scooters.stream().filter(s -> "Maintenance".equals(s.getStatus())).count();
        int total = scooters.size();

        stats.put("running", running);
        stats.put("locked", locked);
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