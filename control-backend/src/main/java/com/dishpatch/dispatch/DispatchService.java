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

import java.time.Clock;
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
 * Nothing blocks, and nothing waits: progress is re-checked every tick. The tick
 * does not get a scheduler to itself — enabling the STOMP broker contributes a
 * TaskScheduler bean and {@code @EnableScheduling} binds to it, so this shares the
 * MessageBroker pool that pushes updates to the dashboard. A blocking tick would
 * stall the dashboard as well as every delivery behind it.
 * <p>
 * Arrival is read from the robot's reported position rather than assumed — the
 * driving stages end when it is within {@link #ARRIVAL_RADIUS_M} of its
 * destination. Only the serve dwell is on a clock.
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
     * How long after publishing a goal before Nav2's silence means anything.
     * <p>
     * A freshly published goal is not live yet: it crosses a WebSocket to another
     * host, becomes a ROS message, and only then is accepted by the action server
     * and reported back. Concluding "no live goal" inside that window would re-send
     * on top of a goal that was already on its way — which is a preemption, and
     * preempting our own goals is the pathology this fleet already had.
     */
    private static final long GOAL_GRACE_MS = 5_000;

    /**
     * Deliberately pessimistic cruising speed, in metres per second, used only to
     * size how long a drive leg is allowed to take. Observed legs run at 0.85-1.4;
     * a third of that leaves the deadline as a genuine backstop rather than
     * something a slow-but-healthy delivery can trip.
     */
    private static final double PLANNING_SPEED_MPS = 0.4;

    /** Flat allowance per leg for planning, acceptance and acceleration. */
    private static final long DRIVE_OVERHEAD_MS = 10_000;

    /** Floor on a leg's budget, so a very short hop still gets a sane window. */
    private static final long MIN_DRIVE_BUDGET_MS = 20_000;

    /** Publishes of the same stage goal before the delivery is given up on. */
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

    /**
     * When each homing robot's counter goal was last published.
     * <p>
     * A homing robot holds no assignment, so nothing else would ever notice that
     * its goal died — it would simply never become assignable again. This is what
     * lets the homing pass re-send, the same way a delivery can.
     */
    private final Map<Integer, Long> homingPublishedAt = new ConcurrentHashMap<>();

    /** Pending orders that had no robot on the last tick. */
    private volatile int queuedOrders;

    /** When the tick last ran; 0 until the first one. */
    private volatile long lastTickMillis;

    /**
     * Every stage of a delivery is timed against this, so tests can drive the grace
     * windows and deadlines without waiting out a real minute.
     */
    private final Clock clock;

    /**
     * The constructor Spring uses.
     * <p>
     * {@code @Autowired} is load-bearing, not decoration. A class with a single
     * constructor gets it used implicitly; add a second and Spring finds two
     * candidates, picks neither, and falls back to looking for a no-arg constructor
     * — the context then fails to start. That failure is at startup, not compile
     * time, so nothing catches it but running the app.
     */
    @Autowired
    public DispatchService(
            OrderService orderService,
            DropPointService dropPointService,
            RosBridgeService rosBridgeService,
            RobotService robotService,
            @Value("${dispatch.enabled:true}")
            boolean enabled
    ) {
        this(
                orderService,
                dropPointService,
                rosBridgeService,
                robotService,
                enabled,
                Clock.systemUTC()
        );
    }

    /** For tests, which supply a clock they can move. */
    DispatchService(
            OrderService orderService,
            DropPointService dropPointService,
            RosBridgeService rosBridgeService,
            RobotService robotService,
            boolean enabled,
            Clock clock
    ) {
        this.orderService = orderService;
        this.dropPointService = dropPointService;
        this.rosBridgeService = rosBridgeService;
        this.robotService = robotService;
        this.enabled = enabled;
        this.clock = clock;
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
        lastTickMillis = clock.millis();

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
        long now = clock.millis();

        for (DispatchAssignment assignment : List.copyOf(assignments.values())) {
            switch (assignment.state()) {
                case TO_TABLE -> {
                    if (hasArrived(assignment.robotId(), assignment.destination())) {
                        startServing(assignment, now);
                    } else {
                        recoverIfStalled(assignment, assignment.destination(), now);
                    }
                }
                case AT_TABLE -> {
                    if (now >= assignment.deadlineMillis()) {
                        completeAndSendBack(assignment);
                    }
                }
                case RETURNING -> {
                    if (hasArrived(assignment.robotId(), COUNTER)) {
                        releaseRobot(assignment);
                    } else {
                        recoverIfStalled(assignment, COUNTER, now);
                    }
                }
            }
        }
    }

    /**
     * Decides what to do about a drive leg that has not finished yet.
     * <p>
     * A driving stage used to have exactly one way out: arrive. Anything that
     * stopped the robot short of its destination froze the delivery for good — the
     * robot stayed in {@link #assignments}, which excluded it from the homing pass
     * that would otherwise have rescued it, and every code path involved was a
     * success path, so nothing was logged. Two robots were lost that way on
     * 2026-08-11 when Nav2 aborted their goals a few milliseconds after receiving
     * them.
     * <p>
     * The signature of a lost goal is the one the package README named long before
     * it happened: Nav2 reports no live goal while the robot is nowhere near where
     * it was sent. That is what this looks for.
     */
    private void recoverIfStalled(
            DispatchAssignment assignment,
            String destination,
            long now
    ) {
        // Too soon to read anything into Nav2's silence.
        if (now < assignment.goalPublishedAtMillis() + GOAL_GRACE_MS) {
            return;
        }

        int robotId = assignment.robotId();

        if (rosBridgeService.isNavigating(robotId)) {
            // Nav2 still holds a live goal, so the robot is on its way and must be
            // left alone: re-publishing now would preempt a working goal. If it is
            // also past its deadline something is wrong that re-sending cannot fix,
            // so give up rather than fight Nav2 for control of the robot.
            if (now >= assignment.deadlineMillis()) {
                abandon(
                        assignment,
                        "still navigating well past its deadline",
                        now
                );
            }
            return;
        }

        // Nav2 is idle and the robot has not arrived. The goal is gone — aborted,
        // rejected, or never accepted in the first place.
        String reason = rosBridgeService.lastGoalFailed(robotId)
                ? "Nav2 aborted the goal"
                : "Nav2 has no goal for it";

        if (assignment.attempts() >= MAX_GOAL_ATTEMPTS) {
            abandon(assignment, reason + " after " + assignment.attempts()
                    + " attempts", now);
            return;
        }

        if (!publishGoal(robotId, destination)) {
            // rosbridge is down or the drop point vanished. Not this delivery's
            // fault and not worth an attempt — try again on the next tick.
            return;
        }

        assignments.put(
                assignment.orderId(),
                assignment.retried(
                        now + driveBudgetMillis(robotId, destination),
                        now
                )
        );

        logger.warning(
                "Robot " + robotId + " stalled en route to " + destination
                        + " (" + reason + ") — re-sent goal, attempt "
                        + (assignment.attempts() + 1) + " of " + MAX_GOAL_ATTEMPTS
                        + " for order " + assignment.orderId()
        );
    }

    /**
     * Gives up on a delivery and hands the robot back to the fleet.
     * <p>
     * The order is not failed: during {@link DispatchState#TO_TABLE} it is still
     * Preparing in DynamoDB, so dropping the assignment puts it straight back in
     * the queue for whichever robot is free next. Past that point it has already
     * been completed and there is nothing to return.
     * <p>
     * The robot goes into {@link #homing} rather than {@link #atCounter}: it is
     * somewhere on the floor, not parked, and it must prove it got back before it
     * is handed another meal.
     */
    private void abandon(DispatchAssignment assignment, String reason, long now) {
        int robotId = assignment.robotId();

        assignments.remove(assignment.orderId());
        atCounter.remove(robotId);

        boolean headingHome = publishGoal(robotId, COUNTER);

        if (headingHome) {
            homing.add(robotId);
            homingPublishedAt.put(robotId, now);
        }

        robotService.setAssignment(
                robotId, RobotService.STATUS_RETURNING, COUNTER, null);

        logger.warning(
                "Giving up on order " + assignment.orderId() + " at stage "
                        + assignment.state() + ": robot " + robotId + " "
                        + reason + ". Robot sent back to " + COUNTER
                        + (headingHome ? "" : " (goal not sent; homing pass will retry)")
                        + (assignment.state() == DispatchState.TO_TABLE
                                ? ". Order returns to the queue."
                                : ". Order was already delivered.")
        );
    }

    /**
     * How long a robot may take to drive to a drop point before something is
     * assumed to have gone wrong, sized from the distance it actually has to cover.
     * <p>
     * A fixed timeout cannot serve both a 6 m hop and a 30 m run across the floor;
     * whatever value suited one would be absurd for the other.
     */
    private long driveBudgetMillis(int robotId, String destination) {
        double metres = distanceTo(robotId, destination);

        if (metres < 0) {
            // Position unknown, so distance means nothing. The floor still bounds it.
            return MIN_DRIVE_BUDGET_MS;
        }

        long budget = (long) (metres / PLANNING_SPEED_MPS * 1000) + DRIVE_OVERHEAD_MS;
        return Math.max(budget, MIN_DRIVE_BUDGET_MS);
    }

    /** Robot reached the table: stay Serving while the meal is handed over. */
    private void startServing(DispatchAssignment assignment, long now) {
        assignments.put(
                assignment.orderId(),
                assignment.movedTo(
                        DispatchState.AT_TABLE,
                        assignment.destination(),
                        now + SERVE_DWELL_MS,
                        0 // parked at the table; no goal in flight to time out
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
     * The counter goal is best effort — if it fails the robot still moves to
     * RETURNING with a deadline, and {@link #recoverIfStalled} re-sends it. This
     * used to claim the homing pass would retry it, which it could not: that pass
     * skips robots holding an assignment, and a RETURNING robot holds one until it
     * arrives.
     */
    private void completeAndSendBack(DispatchAssignment assignment) {
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

        long now = clock.millis();

        publishGoal(assignment.robotId(), COUNTER);
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
                        now + driveBudgetMillis(assignment.robotId(), COUNTER),
                        now
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

        homingPublishedAt.keySet().retainAll(homing);

        long now = clock.millis();

        // Homing robots that have reached the counter — and those whose counter goal
        // died on the way, which would otherwise sit still forever holding no order
        // and therefore attracting no attention at all.
        for (Integer robotId : List.copyOf(homing)) {
            if (hasArrived(robotId, COUNTER)) {
                homing.remove(robotId);
                homingPublishedAt.remove(robotId);
                arriveAtCounter(robotId);
                continue;
            }

            long publishedAt = homingPublishedAt.getOrDefault(robotId, now);

            if (now < publishedAt + GOAL_GRACE_MS
                    || rosBridgeService.isNavigating(robotId)) {
                continue;
            }

            if (publishGoal(robotId, COUNTER)) {
                homingPublishedAt.put(robotId, now);
                logger.warning(
                        "Robot " + robotId + " stopped short of " + COUNTER
                                + " with no live goal — re-sent it home"
                );
            }
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
            homingPublishedAt.put(robotId, now);

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

            long now = clock.millis();

            assignments.put(orderId, new DispatchAssignment(
                    orderId,
                    robotId,
                    destination,
                    DispatchState.TO_TABLE,
                    now + driveBudgetMillis(robotId, destination),
                    1,
                    now
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
                : clock.millis() - lastTickMillis;
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

        return Math.max(0, assignment.deadlineMillis() - clock.millis());
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

    /**
     * Whether the last goal Nav2 reported for this robot ended in failure.
     * <p>
     * Read alongside {@link #isNavigating}: false there plus true here is a goal
     * Nav2 gave up on, which is what stranded two robots on 2026-08-11.
     */
    public boolean hasGoalFailed(int robotId) {
        return rosBridgeService.lastGoalFailed(robotId);
    }
}
