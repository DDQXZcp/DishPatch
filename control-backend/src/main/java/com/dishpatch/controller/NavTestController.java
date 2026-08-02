package com.dishpatch.controller;

import com.dishpatch.map.DropPointMap;
import com.dishpatch.map.DropPointService;
import com.dishpatch.service.RosBridgeService;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;


/**
 * Manual nav-goal endpoints for bench testing, until order-driven dispatch exists.
 * <p>
 * Resolves drop point ids through {@link DropPointService} and publishes poses via
 * {@link RosBridgeService}, so the map lookup and goal publish can be exercised
 * without a real order.
 * <p>
 * Registered only when {@code nav.test-endpoint.enabled=true}; every route 404s
 * otherwise. It commands physical robots and the backend has no authentication,
 * so it must stay disabled in production.
 */
@RestController
@RequestMapping("/api/nav")
@ConditionalOnProperty(name = "nav.test-endpoint.enabled", havingValue = "true")
public class NavTestController {

    private final DropPointService dropPointService;
    private final RosBridgeService rosBridgeService;

    public NavTestController(
            DropPointService dropPointService,
            RosBridgeService rosBridgeService
    ) {
        this.dropPointService = dropPointService;
        this.rosBridgeService = rosBridgeService;
    }

    /** Request body for {@link #goTo}; field names are the JSON keys. */
    public record GoalRequest(int robotId, String destination) { }

    /**
     * health endpoint
     * @return 200 with {@code rosbridgeConnected}, whether the fleet link is open,
     *         and {@code destinationsLoaded}, how many drop points were parsed at
     *         startup (25 for the current floorplan)
     */
    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> health() {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("rosbridgeConnected", rosBridgeService.isConnected());
        body.put("destinationsLoaded", dropPointService.all().size());
        return ResponseEntity.ok(body);
    }

    /**
     * Lists every drop point the map defines, for discovering valid
     * {@link GoalRequest#destination()} values.
     *
     * @return 200 with {@code frameId}, {@code count}, and {@code destinations},
     *         each entry carrying its id and map-frame pose
     */
    @GetMapping("/destinations")
    public ResponseEntity<Map<String, Object>> destinations() {
        List<DropPointMap.DropPoint> points = dropPointService.all();

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("frameId", dropPointService.frameId());
        body.put("count", points.size());
        body.put("destinations", points);
        return ResponseEntity.ok(body);
    }

    /**
     * Sends one robot to one named drop point.
     * <p>
     * Publishes the resolved pose to {@code /robot{id}/goal_pose}; Nav2 on the
     * robot plans the actual route. A goal is accepted here as soon as it is
     * published — nothing reports back whether the robot arrived.
     *
     * @param request robot id (1..{@code rosbridge.robot-count}) and a drop point
     *                id such as {@code T4} or {@code R7}
     * @return 200 with the resolved pose when published; 404 if the destination is
     *         unknown; 503 if rosbridge is disconnected; 502 if the publish failed
     */
    @PostMapping("/goTo")
    public ResponseEntity<Map<String, Object>> goTo(@RequestBody GoalRequest request) {
        return dropPointService.find(request.destination())
                .map(point -> send(request.robotId(), point))
                .orElseGet(() -> ResponseEntity.status(404).body(
                        error("Unknown destination: " + request.destination())));
    }

    private ResponseEntity<Map<String, Object>> send(
            int robotId,
            DropPointMap.DropPoint point
    ) {
        if (!rosBridgeService.isConnected()) {
            return ResponseEntity.status(503).body(error("rosbridge not connected"));
        }

        try {
            rosBridgeService.publishGoal(robotId, point.x(), point.y(), point.yaw());
        } catch (Exception exception) {
            return ResponseEntity.status(502).body(
                    error("Failed to publish goal: " + exception.getMessage()));
        }

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("sent", true);
        body.put("robotId", robotId);
        body.put("destination", point.id());
        body.put("x", point.x());
        body.put("y", point.y());
        body.put("yaw", point.yaw());
        return ResponseEntity.ok(body);
    }

    private Map<String, Object> error(String message) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("sent", false);
        body.put("error", message);
        return body;
    }
}
