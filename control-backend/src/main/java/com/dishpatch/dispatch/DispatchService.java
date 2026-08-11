package com.dishpatch.dispatch;

import com.dishpatch.map.DropPointMap;
import com.dishpatch.map.DropPointService;
import com.dishpatch.order.OrderService;
import com.dishpatch.order.OrderStatus;
import com.dishpatch.service.RobotService;
import com.dishpatch.service.RosBridgeService;

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
import java.util.logging.Logger;
import java.util.stream.Collectors;

/**
 * Drives the meal dispatch pipeline (issue #60):
 * <pre>
 *   fetch order → assign robot → nav to table → serve → mark complete → nav to counter
 * </pre>
 *
 * Each delivery is a {@link DispatchAssignment} carrying a stage. A scheduled tick
 * advances the ones that are ready, then assigns whatever new orders it can.
 * Nothing blocks: Spring's default scheduler runs a single thread, so one sleeping
 * delivery would stall every other one behind it.
 * <p>
 * Arrival is read from the robot's reported position rather than assumed — the
 * driving stages end when it is within {@link #ARRIVAL_RADIUS_M} of its
 * destination. Only the serve dwell is on a clock.
 * <p>
 * A goal can be lost — dropped with a closing rosbridge session, or aborted by Nav2 —
 * and a driving stage that has lost its goal would otherwise never end, since the
 * only exit is an arrival that will never happen. So a driving stage Nav2 is not
 * working on has its goal re-sent; see {@link #resendGoalIfStalled}.
 * <p>
 * Configure in application.properties:
 * <pre>
 *   dispatch.enabled=true
 * </pre>
 */
@Service
public class DispatchService {

    private static final Logger logger =
            Logger.getLogger(DispatchService.class.getName());

    /** How often the tick runs. */
    private static final long POLL_INTERVAL_MS = 1_000;

    /** Time spent at the table serving, once the robot has actually arrived. */
    private static final long SERVE_DWELL_MS = 5_000;

    /**
     * How close to a drop point counts as arrived, in metres.
     * <p>
     * Only a sanity check on top of Nav2's own verdict — it distinguishes
     * "finished at the destination" from "gave up somewhere else". Deliberately
     * looser than Nav2's xy_goal_tolerance rather than matching it, since matching
     * would put both sides on the same knife edge.
     */
    private static final double ARRIVAL_RADIUS_M = 0.6;

    /** Drop point every robot returns to; must exist in drop-points.json. */
    private static final String COUNTER = "counter";

    /**
     * How long a driving stage must look idle before its goal is re-sent.
     * <p>
     * Nav2 does not report a goal the instant it is published — it has to reach
     * goal_relay_node, be accepted, and come back on the status topic through
     * rosbridge. For that window {@code isNavigating} is still false while the goal
     * is perfectly healthy, so re-sending immediately would publish a duplicate goal
     * on every tick of every normal delivery. Comfortably longer than that round
     * trip, and still far shorter than a stranded robot.
     */
    private static final long GOAL_GRACE_MS = 5_000;

    /**
     * Goals published for one stage before the delivery is left alone.
     * <p>
     * A robot that has ignored this many goals is not going to be fixed by another
     * one. It stops here and stays visible on the status endpoint with its attempt
     * count, rather than driving the fleet from a loop nobody is watching.
     */
    private static final int MAX_GOAL_ATTEMPTS = 3;

    private final OrderService orderService;
    private final DropPointService dropPointService;
    private final RosBridgeService rosBridgeService;
    private final RobotService robotService;

    private final boolean enabled;

    /** In-flight deliveries, keyed by order id. Doubles as the re-dispatch guard. */
    private final Map<String, DispatchAssignment> assignments =
            new ConcurrentHashMap<>();

    /** Orders that cannot be dispatched, keyed by order id, with the reason. */
    private final Map<String, String> skipped = new ConcurrentHashMap<>();

    /**
     * Robots at the counter and idle.
     */
    private final Set<Integer> atCounter = ConcurrentHashMap.newKeySet();

    /** Robots driving to the counter with no order, until their position says they arrived. */
    private final Set<Integer> homing = ConcurrentHashMap.newKeySet();

    /** Pending orders that had no robot on the last tick. */
    private volatile int queuedOrders;

    /** When the tick last ran; 0 until the first one. */
    private volatile long lastTickMillis;

    public DispatchService(
            OrderService orderService,
            DropPointService dropPointService,
            RosBridgeService rosBridgeService,
            RobotService robotService,
            @Value("${dispatch.enabled:true}")
            boolean enabled
    ) {
        this.orderService = orderService;
        this.dropPointService = dropPointService;
        this.rosBridgeService = rosBridgeService;
        this.robotService = robotService;
        this.enabled = enabled;
    }

    /**
     * Advances in-flight deliveries, then assigns new orders.
     * <p>
     * {@code fixedDelay} rather than {@code fixedRate} so runs cannot stack up, and
     * the body is wrapped: an escaping exception permanently cancels future runs of
     * a {@code @Scheduled} method, and does so silently.
     */
    @Scheduled(fixedDelay = POLL_INTERVAL_MS)
    public void tick() {
        lastTickMillis = System.currentTimeMillis();

        if (!enabled) {
            return;
        }

        // the main logic
        try {
            advanceAssignments();
            manageCounterRobots();
            assignPendingOrders();
        } catch (RuntimeException exception) {
            logger.warning("Dispatch tick failed: " + exception);
        }
    }

    /**
     * Moves every assignment that is ready on to its next stage.
     * <p>
     * The driving stages advance on the robot's reported position; only the serve
     * dwell is on a clock.
     */
    private void advanceAssignments() {
        long now = System.currentTimeMillis();

        for (DispatchAssignment assignment : List.copyOf(assignments.values())) {
            switch (assignment.state()) {
                case TO_TABLE -> {
                    if (hasArrived(assignment.robotId(), assignment.destination())) {
                        startServing(assignment, now);
                    } else {
                        resendGoalIfStalled(assignment, now);
                    }
                }
                case AT_TABLE -> {
                    if (now >= assignment.deadlineMillis()) {
                        completeAndSendBack(assignment, now);
                    }
                }
                case RETURNING -> {
                    if (hasArrived(assignment.robotId(), COUNTER)) {
                        releaseRobot(assignment);
                    } else {
                        resendGoalIfStalled(assignment, now);
                    }
                }
            }
        }
    }

    /**
     * Re-publishes the goal for a driving stage that Nav2 is no longer working on.
     * <p>
     * A driving stage ends on arrival, and arrival needs a goal. If that goal is
     * lost — dropped with a closing socket, or aborted by Nav2 — nothing else in this
     * class will ever move the robot again: {@code manageCounterRobots} skips
     * anything holding an assignment, and the assignment is only released on arrival.
     * Without this the robot sits where it stopped until the backend restarts.
     */
    private void resendGoalIfStalled(DispatchAssignment assignment, long now) {
        // Nav2 still has it. Slow is not stalled.
        if (rosBridgeService.isNavigating(assignment.robotId())) {
            return;
        }

        // A robot that is not reporting cannot be judged stalled, and goals sent into
        // the silence would spend the attempt budget before anything can hear them.
        // Reported as robotStale on the endpoint; wait for it to come back.
        if (!robotService.isFresh(assignment.robotId())) {
            return;
        }

        // Too soon to tell: a goal published moments ago has not been reported yet.
        if (now - assignment.lastGoalMillis() < GOAL_GRACE_MS) {
            return;
        }

        if (assignment.goalAttempts() >= MAX_GOAL_ATTEMPTS) {
            return;
        }

        if (!publishGoal(assignment.robotId(), assignment.destination())) {
            return; // no goal, no state change — retried next tick
        }

        assignments.put(assignment.orderId(), assignment.withGoalResent(now));

        logger.warning(
                "Robot " + assignment.robotId() + " stalled short of "
                        + assignment.destination() + " with no live goal — re-sent"
                        + " (attempt " + (assignment.goalAttempts() + 1) + " of "
                        + MAX_GOAL_ATTEMPTS + ")"
        );
    }

    /** Robot reached the table: stay Serving while the meal is handed over. */
    private void startServing(DispatchAssignment assignment, long now) {
        assignments.put(
                assignment.orderId(),
                assignment.movedTo(
                        DispatchState.AT_TABLE,
                        assignment.destination(),
                        now + SERVE_DWELL_MS,
                        0 // parked and serving; no goal for this stage
                )
        );

        logger.info(
                "Robot " + assignment.robotId() + " reached "
                        + assignment.destination() + " — serving order "
                        + assignment.orderId()
        );
    }

    /**
     * Serve dwell expired: mark the order complete and start the run back.
     * <p>
     * The robot moves to RETURNING whether or not the counter goal went out, because
     * the meal is handed over either way and the order is already complete. A goal
     * that failed to publish is recorded as such, and {@link #resendGoalIfStalled}
     * picks it up on a later tick — the homing pass cannot, since it skips every
     * robot holding an assignment.
     */
    private void completeAndSendBack(DispatchAssignment assignment, long now) {
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

        boolean sent = publishGoal(assignment.robotId(), COUNTER);

        if (!sent) {
            logger.warning(
                    "Counter goal for robot " + assignment.robotId()
                            + " did not go out — will be re-sent"
            );
        }

        robotService.setAssignment(
                assignment.robotId(),
                RobotService.STATUS_RETURNING,
                COUNTER,
                null // the meal has been handed over
        );

        assignments.put(
                assignment.orderId(),
                assignment.movedTo(
                        DispatchState.RETURNING,
                        COUNTER,
                        0, // no timer on a driving stage
                        sent ? now : 0
                )
        );
    }

    /** Robot reached the counter with no order left to deliver: it is free. */
    private void releaseRobot(DispatchAssignment assignment) {
        assignments.remove(assignment.orderId());
        atCounter.add(assignment.robotId());
        robotService.setAssignment(
                assignment.robotId(),
                RobotService.STATUS_WAITING,
                null, // parked, not headed anywhere
                null
        );

        logger.info(
                "Robot " + assignment.robotId() + " back at " + COUNTER
                        + " and free"
        );
    }

    /**
     * Keeps the counter set honest, so that Waiting always means "idle at the
     * counter" rather than merely "idle".
     * <p>
     * Robots are not born at the counter — one that has just booted, or that
     * reappears after the backend restarted mid-delivery, is standing wherever it
     * stopped. Such a robot is driven to the counter first and becomes assignable
     * only once its reported position says it got there.
     */
    private void manageCounterRobots() {
        List<Integer> fresh = robotService.getFreshRobotIds();
        Set<Integer> freshIds = Set.copyOf(fresh);

        // Robots that went silent: forget where they were, so they home again on
        // their return rather than being trusted to still be at the counter.
        atCounter.retainAll(freshIds);
        homing.retainAll(freshIds);

        // Homing robots that have reached the counter.
        for (Integer robotId : List.copyOf(homing)) {
            if (!hasArrived(robotId, COUNTER)) {
                continue;
            }

            homing.remove(robotId);
            arriveAtCounter(robotId);
        }

        // Robots we have never placed at the counter.
        Set<Integer> busy = busyRobotIds();

        for (Integer robotId : fresh) {
            if (busy.contains(robotId)
                    || homing.contains(robotId)
                    || atCounter.contains(robotId)) {
                continue;
            }

            // Already parked there — no need to command it anywhere.
            if (hasArrived(robotId, COUNTER)) {
                arriveAtCounter(robotId);
                continue;
            }

            // No goal, no state change — retried next tick.
            if (!publishGoal(robotId, COUNTER)) {
                continue;
            }

            robotService.setAssignment(
                    robotId, RobotService.STATUS_RETURNING, COUNTER, null);
            homing.add(robotId);

            logger.info(
                    "Robot " + robotId + " is not at " + COUNTER
                            + " — homing before it can take orders"
            );
        }
    }

    /** Marks a robot parked at the counter and available. */
    private void arriveAtCounter(int robotId) {
        atCounter.add(robotId);
        robotService.setAssignment(
                robotId, RobotService.STATUS_WAITING, null, null);

        logger.info("Robot " + robotId + " at " + COUNTER + " and free");
    }

    /**
     * Whether a robot has finished driving to a drop point.
     * <p>
     * Nav2 decides: while it holds a live goal the robot is still on its way,
     * whatever its position says. The distance check then separates "stopped
     * because it got there" from "stopped because the goal was aborted".
     * <p>
     * False when the destination is unknown or the robot has never reported — an
     * unanswerable question is not an arrival.
     */
    private boolean hasArrived(int robotId, String destination) {
        if (rosBridgeService.isNavigating(robotId)) {
            return false;
        }

        double distance = distanceTo(robotId, destination);
        return distance >= 0 && distance <= ARRIVAL_RADIUS_M;
    }

    /** Metres from a robot to a drop point, or -1 if either position is unknown. */
    private double distanceTo(int robotId, String destination) {
        Optional<DropPointMap.DropPoint> point =
                dropPointService.find(destination);

        Optional<RobotService.Position> position =
                robotService.getPosition(robotId);

        if (point.isEmpty() || position.isEmpty()) {
            return -1;
        }

        return Math.hypot(
                position.get().x() - point.get().x(),
                position.get().y() - point.get().y()
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
        long now = System.currentTimeMillis();
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
            atCounter.remove(robotId); // it is leaving the counter

            assignments.put(orderId, new DispatchAssignment(
                    orderId,
                    robotId,
                    destination,
                    DispatchState.TO_TABLE,
                    0, // no timer on a driving stage
                    now, // the goal above went out
                    1
            ));
            robotService.setAssignment(
                    robotId, RobotService.STATUS_SERVING, destination, orderId);

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
     * @return true when the goal was written to an open rosbridge session. Still not
     *         a guarantee it reached Nav2 — the session can close immediately after,
     *         taking the goal with it. {@link #resendGoalIfStalled} is what closes
     *         that gap, by re-sending when Nav2 turns out never to have got it
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
            return rosBridgeService.publishGoal(
                    robotId,
                    point.get().x(),
                    point.get().y(),
                    point.get().yaw()
            );

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

    /**
     * Robots parked at the counter, idle, and still reporting telemetry — the ones
     * that can be given an order. A robot is removed when it leaves on a delivery
     * and added back when it returns, so this never includes a busy robot.
     */
    public List<Integer> freeRobotIds() {
        List<Integer> free = new ArrayList<>();

        for (Integer robotId : robotService.getFreshRobotIds()) {
            if (atCounter.contains(robotId)) {
                free.add(robotId);
            }
        }

        return free;
    }

    private Set<Integer> busyRobotIds() {
        return assignments.values()
                .stream()
                .map(DispatchAssignment::robotId)
                .collect(Collectors.toSet());
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
                : System.currentTimeMillis() - lastTickMillis;
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

    /**
     * Serving time left, or 0 on the driving stages, which advance on position
     * rather than a clock.
     */
    public long millisRemaining(DispatchAssignment assignment) {
        if (assignment.state() != DispatchState.AT_TABLE) {
            return 0;
        }

        return Math.max(0, assignment.deadlineMillis() - System.currentTimeMillis());
    }

    /**
     * Metres between the robot and where it is headed, or -1 if either position is
     * unknown. The main diagnostic for a delivery that is not progressing.
     */
    public double metresToGo(DispatchAssignment assignment) {
        return distanceTo(assignment.robotId(), assignment.destination());
    }

    /**
     * True when an assigned robot has stopped reporting telemetry. Such a robot has
     * already dropped off the frontend map while this delivery still holds it.
     */
    public boolean isRobotStale(int robotId) {
        return !robotService.isFresh(robotId);
    }

    /**
     * Whether Nav2 is actually working on a goal for this robot.
     * <p>
     * False while a driving stage is in progress means the goal was lost or
     * aborted — the robot will sit still until it is re-sent.
     */
    public boolean isNavigating(int robotId) {
        return rosBridgeService.isNavigating(robotId);
    }
}
