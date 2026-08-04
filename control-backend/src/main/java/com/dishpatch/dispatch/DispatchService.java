package com.dishpatch.dispatch;

import com.dishpatch.map.DropPointMap;
import com.dishpatch.map.DropPointService;
import com.dishpatch.order.OrderService;
import com.dishpatch.order.OrderStatus;
import com.dishpatch.service.RobotService;
import com.dishpatch.service.RosBridgeService;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.LongSupplier;
import java.util.logging.Logger;
import java.util.stream.Collectors;

/**
 * Drives the simulated meal dispatch pipeline (issue #60):
 * <pre>
 *   fetch order → assign robot → nav to table → dwell → mark complete → nav to counter
 * </pre>
 *
 * Each delivery is a {@link DispatchAssignment} carrying a stage and a deadline.
 * A scheduled tick advances any assignment whose deadline has passed, then assigns
 * whatever new orders it can. Nothing blocks: Spring's default scheduler runs a
 * single thread, so one sleeping delivery would stall every other one behind it.
 * <p>
 * "Simulated" means arrival is assumed rather than observed — nothing reports back
 * from Nav2, so the dwell timers stand in for travel time.
 * <p>
 * Configure in application.properties:
 * <pre>
 *   dispatch.enabled=true
 *   dispatch.poll-interval-ms=2000
 *   dispatch.table-dwell-ms=5000
 *   dispatch.return-dwell-ms=8000
 *   dispatch.counter=counter
 * </pre>
 */
@Service
public class DispatchService {

    private static final Logger logger =
            Logger.getLogger(DispatchService.class.getName());

    private final OrderService orderService;
    private final DropPointService dropPointService;
    private final RosBridgeService rosBridgeService;
    private final RobotService robotService;

    private final boolean enabled;
    private final long tableDwellMillis;
    private final long returnDwellMillis;
    private final String counterId;

    /** Wall clock, overridable so tests can advance time without sleeping. */
    private final LongSupplier clock;

    /** In-flight deliveries, keyed by order id. Doubles as the re-dispatch guard. */
    private final Map<String, DispatchAssignment> assignments =
            new ConcurrentHashMap<>();

    /** Orders that cannot be dispatched, keyed by order id, with the reason. */
    private final Map<String, String> skipped = new ConcurrentHashMap<>();

    /** Pending orders that had no robot on the last tick. */
    private volatile int queuedOrders;

    /** When the tick last ran; 0 until the first one. */
    private volatile long lastTickMillis;

    @Autowired
    public DispatchService(
            OrderService orderService,
            DropPointService dropPointService,
            RosBridgeService rosBridgeService,
            RobotService robotService,
            @Value("${dispatch.enabled:true}")
            boolean enabled,
            @Value("${dispatch.table-dwell-ms:5000}")
            long tableDwellMillis,
            @Value("${dispatch.return-dwell-ms:8000}")
            long returnDwellMillis,
            @Value("${dispatch.counter:counter}")
            String counterId
    ) {
        this(
                orderService,
                dropPointService,
                rosBridgeService,
                robotService,
                enabled,
                tableDwellMillis,
                returnDwellMillis,
                counterId,
                System::currentTimeMillis
        );
    }

    /** Test seam: as the injected constructor, but with a controllable clock. */
    DispatchService(
            OrderService orderService,
            DropPointService dropPointService,
            RosBridgeService rosBridgeService,
            RobotService robotService,
            boolean enabled,
            long tableDwellMillis,
            long returnDwellMillis,
            String counterId,
            LongSupplier clock
    ) {
        this.orderService = orderService;
        this.dropPointService = dropPointService;
        this.rosBridgeService = rosBridgeService;
        this.robotService = robotService;
        this.enabled = enabled;
        this.tableDwellMillis = tableDwellMillis;
        this.returnDwellMillis = returnDwellMillis;
        this.counterId = counterId;
        this.clock = clock;
    }

    /**
     * Advances in-flight deliveries, then assigns new orders.
     * <p>
     * {@code fixedDelay} rather than {@code fixedRate} so runs cannot stack up, and
     * the body is wrapped: an escaping exception permanently cancels future runs of
     * a {@code @Scheduled} method, and does so silently.
     */
    @Scheduled(fixedDelayString = "${dispatch.poll-interval-ms:2000}")
    public void tick() {
        lastTickMillis = clock.getAsLong();

        if (!enabled) {
            return;
        }

        try {
            advanceAssignments();
            assignPendingOrders();
        } catch (RuntimeException exception) {
            logger.warning("Dispatch tick failed: " + exception);
        }
    }

    /** Moves every assignment whose deadline has passed on to its next stage. */
    private void advanceAssignments() {
        long now = clock.getAsLong();

        for (DispatchAssignment assignment : List.copyOf(assignments.values())) {
            if (now < assignment.deadlineMillis()) {
                continue;
            }

            switch (assignment.state()) {
                case TO_TABLE -> completeAndSendBack(assignment, now);
                case RETURNING -> releaseRobot(assignment);
            }
        }
    }

    /**
     * Table dwell expired: mark the order complete and start the run back.
     * <p>
     * The counter goal is best effort — if it fails the robot still moves to
     * RETURNING so it is eventually freed, rather than being stranded forever.
     */
    private void completeAndSendBack(
            DispatchAssignment assignment,
            long now
    ) {
        Optional<Map<String, Object>> completed =
                orderService.updateStatus(
                        assignment.orderId(),
                        OrderStatus.COMPLETED
                );

        if (completed.isEmpty()) {
            logger.warning(
                    "Order " + assignment.orderId()
                            + " disappeared before it could be completed"
            );
        } else {
            logger.info(
                    "Order " + assignment.orderId() + " delivered to "
                            + assignment.destination() + " by robot "
                            + assignment.robotId()
            );
        }

        publishGoal(assignment.robotId(), counterId);
        robotService.setStatus(
                assignment.robotId(),
                RobotService.STATUS_RETURNING
        );

        assignments.put(
                assignment.orderId(),
                assignment.movedTo(
                        DispatchState.RETURNING,
                        counterId,
                        now + returnDwellMillis
                )
        );
    }

    /** Return dwell expired: the robot is assumed back at the counter and free. */
    private void releaseRobot(DispatchAssignment assignment) {
        assignments.remove(assignment.orderId());
        robotService.setStatus(
                assignment.robotId(),
                RobotService.STATUS_WAITING
        );

        logger.info(
                "Robot " + assignment.robotId() + " back at " + counterId
                        + " and free"
        );
    }

    /**
     * Starts a delivery for every pending order that can have one, oldest first.
     * <p>
     * Orders left over — no free robot, or rosbridge down — are only counted. They
     * stay Preparing in DynamoDB, which is the queue, and are retried next tick
     * without any state being kept for them here.
     */
    private void assignPendingOrders() {
        List<Map<String, Object>> pending = pendingOrders();

        // Self-healing: an order that leaves Preparing drops off the skip list, so
        // it stays bounded by the pending orders instead of growing forever.
        skipped.keySet().retainAll(
                pending.stream()
                        .map(DispatchService::orderIdOf)
                        .filter(orderId -> orderId != null)
                        .collect(Collectors.toSet())
        );

        List<Integer> free = freeRobotIds();
        int queued = 0;

        for (Map<String, Object> order : pending) {
            String orderId = orderIdOf(order);

            if (orderId == null
                    || assignments.containsKey(orderId)
                    || skipped.containsKey(orderId)) {
                continue;
            }

            String destination = destinationOf(order);

            if (destination == null) {
                skip(orderId, "Order has no table");
                continue;
            }

            if (dropPointService.find(destination).isEmpty()) {
                skip(orderId, "Unknown destination: " + destination);
                continue;
            }

            if (free.isEmpty() || !rosBridgeService.isConnected()) {
                queued++;
                continue;
            }

            int robotId = free.get(0);

            if (!publishGoal(robotId, destination)) {
                queued++;
                continue;
            }

            free.remove(0);

            assignments.put(orderId, new DispatchAssignment(
                    orderId,
                    robotId,
                    destination,
                    DispatchState.TO_TABLE,
                    clock.getAsLong() + tableDwellMillis
            ));
            robotService.setStatus(robotId, RobotService.STATUS_SERVING);

            logger.info(
                    "Order " + orderId + " assigned to robot " + robotId
                            + " → " + destination
            );
        }

        queuedOrders = queued;
    }

    /** Pending orders, oldest first — {@code getOrders()} sorts newest first. */
    private List<Map<String, Object>> pendingOrders() {
        List<Map<String, Object>> pending = new ArrayList<>();

        for (Map<String, Object> order : orderService.getOrders()) {
            String status = String.valueOf(order.get("orderStatus"));

            if (OrderStatus.PREPARING.getValue().equalsIgnoreCase(status)) {
                pending.add(order);
            }
        }

        pending.sort(Comparator.comparing(
                order -> String.valueOf(order.getOrDefault("orderDate", ""))
        ));

        return pending;
    }

    /**
     * Resolves a drop point and publishes a goal to it.
     *
     * @return true only when the goal actually went out; publishGoal logs and
     *         returns normally when rosbridge is down, so it is no proof by itself
     */
    private boolean publishGoal(int robotId, String destination) {
        Optional<DropPointMap.DropPoint> point =
                dropPointService.find(destination);

        if (point.isEmpty()) {
            logger.warning("Unknown drop point: " + destination);
            return false;
        }

        if (!rosBridgeService.isConnected()) {
            logger.warning(
                    "rosbridge not connected — goal for robot " + robotId
                            + " to " + destination + " not sent"
            );
            return false;
        }

        try {
            rosBridgeService.publishGoal(
                    robotId,
                    point.get().x(),
                    point.get().y(),
                    point.get().yaw()
            );
            return true;

        } catch (Exception exception) {
            logger.warning(
                    "Failed to publish goal for robot " + robotId + ": "
                            + exception.getMessage()
            );
            return false;
        }
    }

    private void skip(String orderId, String reason) {
        if (skipped.put(orderId, reason) == null) {
            logger.warning("Skipping order " + orderId + ": " + reason);
        }
    }

    private static String orderIdOf(Map<String, Object> order) {
        Object orderId = order.get("orderId");
        return orderId == null ? null : orderId.toString();
    }

    /** Drop point id for an order; {@code tableNo} already matches drop point ids. */
    private static String destinationOf(Map<String, Object> order) {
        Object table = order.get("tableNo");

        if (table == null) {
            return null;
        }

        String destination = table.toString().trim();
        return destination.isEmpty() ? null : destination;
    }

    /** Fresh robots that are not already carrying an order. */
    public List<Integer> freeRobotIds() {
        Set<Integer> busy = assignments.values()
                .stream()
                .map(DispatchAssignment::robotId)
                .collect(Collectors.toSet());

        List<Integer> free = new ArrayList<>();

        for (Integer robotId : robotService.getFreshRobotIds()) {
            if (!busy.contains(robotId)) {
                free.add(robotId);
            }
        }

        return free;
    }

    public boolean isEnabled() {
        return enabled;
    }

    public boolean isRosbridgeConnected() {
        return rosBridgeService.isConnected();
    }

    /** Time since the last tick, or -1 before the first one has run. */
    public long millisSinceLastTick() {
        return lastTickMillis == 0
                ? -1
                : clock.getAsLong() - lastTickMillis;
    }

    /**
     * Pending orders with no robot as of the last tick.
     * <p>
     * Recorded during the tick rather than computed per request, so reading the
     * status endpoint does not trigger a DynamoDB scan.
     */
    public int queuedOrders() {
        return queuedOrders;
    }

    /** Snapshot of the in-flight deliveries. */
    public List<DispatchAssignment> assignments() {
        return List.copyOf(assignments.values());
    }

    /** Snapshot of undispatchable orders, keyed by order id, with the reason. */
    public Map<String, String> skipped() {
        return new LinkedHashMap<>(skipped);
    }

    /** Remaining time on an assignment's current stage; never negative. */
    public long millisRemaining(DispatchAssignment assignment) {
        return Math.max(0, assignment.deadlineMillis() - clock.getAsLong());
    }

    /**
     * True when an assigned robot has stopped reporting telemetry. Such a robot has
     * already dropped off the frontend map while this delivery still holds it.
     */
    public boolean isRobotStale(int robotId) {
        return !robotService.isFresh(robotId);
    }
}
