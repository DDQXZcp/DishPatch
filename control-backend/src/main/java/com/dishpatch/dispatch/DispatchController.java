package com.dishpatch.dispatch;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Read-only view of the dispatch pipeline, for diagnosing it.
 * <p>
 * The robot stream on {@code /topic/robot-locations} shows what the dispatcher
 * <em>wrote</em> — it cannot tell "no orders" apart from "rosbridge is down",
 * "telemetry went stale", or "the tick died". This reports the pipeline's own
 * state instead.
 */
@RestController
@RequestMapping("/api/dispatch")
public class DispatchController {

    private final DispatchService dispatchService;

    public DispatchController(DispatchService dispatchService) {
        this.dispatchService = dispatchService;
    }

    /**
     * Current pipeline state.
     * <p>
     * Read {@code millisSinceLastTick} first: larger than a couple of poll
     * intervals means the scheduled tick is no longer running. Then read
     * {@code queuedOrders} against {@code freeRobots} — orders queued while robots
     * sit free is a bug, whereas orders queued with no free robot is just load.
     *
     * @return 200, always
     */
    @GetMapping
    public ResponseEntity<DispatchView> dispatch() {
        List<AssignmentView> active = new ArrayList<>();

        for (DispatchAssignment assignment : dispatchService.assignments()) {
            active.add(new AssignmentView(
                    assignment.orderId(),
                    assignment.robotId(),
                    assignment.destination(),
                    assignment.state(),
                    dispatchService.millisRemaining(assignment),
                    dispatchService.metresToGo(assignment),
                    dispatchService.isNavigating(assignment.robotId()),
                    dispatchService.isRobotStale(assignment.robotId()),
                    assignment.goalAttempts()
            ));
        }

        List<SkippedView> skipped = new ArrayList<>();

        for (Map.Entry<String, String> entry
                : dispatchService.skipped().entrySet()) {
            skipped.add(new SkippedView(entry.getKey(), entry.getValue()));
        }

        return ResponseEntity.ok(new DispatchView(
                dispatchService.isEnabled(),
                dispatchService.isRosbridgeConnected(),
                dispatchService.millisSinceLastTick(),
                dispatchService.queuedOrders(),
                dispatchService.freeRobotIds(),
                active,
                skipped
        ));
    }

    /**
     * One in-flight delivery.
     * <p>
     * Mirrors {@link DispatchAssignment} but reports time remaining rather than the
     * absolute deadline, which is internal and unreadable without doing date maths.
     *
     * @param millisRemaining serving time left; 0 on the driving stages, which
     *                        advance on position rather than a clock
     * @param metresToGo      distance to the destination, or -1 if unknown; the
     *                        thing to read when a delivery is not progressing
     * @param navigating      Nav2 is working on a goal. False during a driving stage
     *                        means the goal was lost or aborted and is being re-sent
     * @param robotStale      robot has stopped reporting telemetry, so it has already
     *                        vanished from the frontend map while still holding this job
     * @param goalAttempts    goals published for the current stage. 1 is the healthy
     *                        case; anything higher means goals are being lost, and a
     *                        value that has stopped climbing short of the destination
     *                        is a delivery that has given up and needs a look
     */
    public record AssignmentView(
            String orderId,
            int robotId,
            String destination,
            DispatchState state,
            long millisRemaining,
            double metresToGo,
            boolean navigating,
            boolean robotStale,
            int goalAttempts
    ) { }

    /** An order that cannot be dispatched, and why. */
    public record SkippedView(
            String orderId,
            String reason
    ) { }

    /**
     * @param millisSinceLastTick -1 before the first tick has run
     * @param queuedOrders        pending orders with no robot, as of the last tick
     * @param freeRobots          ids of robots reporting telemetry and idle
     */
    public record DispatchView(
            boolean enabled,
            boolean rosbridgeConnected,
            long millisSinceLastTick,
            int queuedOrders,
            List<Integer> freeRobots,
            List<AssignmentView> active,
            List<SkippedView> skipped
    ) { }
}
