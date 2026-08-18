package com.dishpatch.dispatch;

import com.dishpatch.map.DropPointMap;
import com.dishpatch.map.DropPointService;
import com.dishpatch.order.OrderService;
import com.dishpatch.order.OrderStatus;
import com.dishpatch.service.RobotService;
import com.dishpatch.service.RosBridgeService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.mockito.ArgumentMatchers;
import org.mockito.Mockito;
import org.springframework.core.io.ClassPathResource;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.logging.Handler;
import java.util.logging.Level;
import java.util.logging.LogRecord;
import java.util.logging.Logger;
import java.util.stream.Collectors;

/**
 * A dispatch pipeline wired up for tests: the collaborators stubbed, the world
 * described in one line at a time, and time under the test's control.
 *
 * <p>Three collaborators are mocked because they reach outside the process —
 * RosBridgeService opens a WebSocket from a {@code @PostConstruct} and retries on a
 * loop, RobotService broadcasts through a SimpMessagingTemplate on every call, and
 * OrderService scans DynamoDB. DropPointService is real, loaded from the staged
 * classpath file the same way {@code DropPointServiceTest} does, so distances in
 * these tests are the restaurant's real geometry rather than invented numbers.
 *
 * <p>The clock is the point of the whole thing. Every interesting behaviour in this
 * package is gated on a grace window, an attempt cap, or a distance-sized deadline,
 * and against the wall clock each of those tests would have to sleep for tens of
 * seconds. {@link #advance} and {@link #run} move time instead.
 *
 * <p><strong>Build on JDK 17</strong>, which is what the pom targets and what CI
 * uses. Mockito cannot instrument classes on much newer JVMs, and the failure reads
 * as "Mockito cannot mock this class" rather than anything about the JDK, so it is
 * worth knowing before you go looking. The map tests pass either way, which makes
 * this look stranger than it is.
 */
final class DispatchFixture {

    /** Matches DispatchService's own poll interval, so run() ticks like the scheduler. */
    private static final Duration POLL_INTERVAL = Duration.ofSeconds(1);

    /** A Clock whose hands the test moves. */
    static final class TestClock extends Clock {

        private Instant now = Instant.parse("2026-08-11T05:49:00Z");

        @Override
        public Instant instant() {
            return now;
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        void advance(Duration by) {
            now = now.plus(by);
        }
    }

    /** One goal that reached rosbridge, as the drop point id it resolves to. */
    record PublishedGoal(int robotId, String destination) { }

    /** One call to RobotService.setAssignment, as the frontend would have seen it. */
    record RobotUpdate(int robotId, String status, String destination, String orderId) { }

    final OrderService orderService = Mockito.mock(OrderService.class);
    final RosBridgeService rosBridgeService = Mockito.mock(RosBridgeService.class);
    final RobotService robotService = Mockito.mock(RobotService.class);
    final DropPointService dropPointService;
    final TestClock clock = new TestClock();
    final DispatchService service;

    private final List<Map<String, Object>> orders = new ArrayList<>();
    private final Map<Integer, RobotService.Position> positions = new HashMap<>();
    private final Set<Integer> freshRobots = new java.util.LinkedHashSet<>();
    private final Map<Integer, Boolean> navigating = new HashMap<>();
    private final Map<Integer, Boolean> goalFailed = new HashMap<>();
    private final List<PublishedGoal> publishedGoals = new ArrayList<>();
    private final List<RobotUpdate> robotUpdates = new ArrayList<>();

    /**
     * Everything the pipeline has logged this JVM, and where this fixture came in.
     * <p>
     * Shared and installed once: the logger is keyed on the class name, so a handler
     * per fixture would pile up across the suite and every one of them would also
     * receive the next test's records.
     */
    private static final List<LogRecord> LOG_RECORDS = new ArrayList<>();
    private static boolean logHandlerInstalled;
    private final int logMark;

    private boolean rosbridgeConnected = true;
    private int orderSequence;

    DispatchFixture() {
        this.dropPointService = loadRealDropPoints();
        this.logMark = installLogCapture();
        stubCollaborators();
        this.service = new DispatchService(
                orderService,
                dropPointService,
                rosBridgeService,
                robotService,
                true,
                clock
        );
    }

    // ── the world ────────────────────────────────────────────────────────────

    /** A robot reporting telemetry, parked at the given drop point. */
    DispatchFixture robotAt(int robotId, String dropPointId) {
        DropPointMap.DropPoint point = point(dropPointId);
        freshRobots.add(robotId);
        positions.put(robotId, new RobotService.Position(point.x(), point.y()));
        navigating.putIfAbsent(robotId, false);
        goalFailed.putIfAbsent(robotId, false);
        return this;
    }

    /** A robot parked at the counter — the only place it can be given an order. */
    DispatchFixture robotAtCounter(int robotId) {
        return robotAt(robotId, "counter");
    }

    /** Teleports a robot, standing in for a drive that Nav2 completed. */
    DispatchFixture moveTo(int robotId, String dropPointId) {
        DropPointMap.DropPoint point = point(dropPointId);
        positions.put(robotId, new RobotService.Position(point.x(), point.y()));
        return this;
    }

    /** A robot that has stopped reporting telemetry. */
    DispatchFixture robotWentSilent(int robotId) {
        freshRobots.remove(robotId);
        return this;
    }

    /** A Preparing order for a table, ordered after every order added before it. */
    DispatchFixture pendingOrder(String orderId, String tableNo) {
        Map<String, Object> order = new LinkedHashMap<>();
        order.put("orderId", orderId);
        order.put("tableNo", tableNo);
        order.put("orderStatus", OrderStatus.PREPARING.getValue());
        order.put("orderDate", "2026-08-11T05:%02d:00Z".formatted(orderSequence++));
        orders.add(order);
        return this;
    }

    /** An order the dispatcher cannot route, for the skip paths. */
    DispatchFixture pendingOrderWithoutTable(String orderId) {
        pendingOrder(orderId, "");
        orders.get(orders.size() - 1).remove("tableNo");
        return this;
    }

    /** An order that stops being Preparing behind the dispatcher's back. */
    DispatchFixture orderLeftPreparing(String orderId) {
        for (Map<String, Object> order : orders) {
            if (orderId.equals(order.get("orderId"))) {
                order.put("orderStatus", OrderStatus.COMPLETED.getValue());
            }
        }
        return this;
    }

    // ── what Nav2 is saying ──────────────────────────────────────────────────

    /** Nav2 holds a live goal: the robot is on its way. */
    DispatchFixture nav2Driving(int robotId) {
        navigating.put(robotId, true);
        goalFailed.put(robotId, false);
        return this;
    }

    /** Nav2 finished cleanly and holds nothing. */
    DispatchFixture nav2Idle(int robotId) {
        navigating.put(robotId, false);
        goalFailed.put(robotId, false);
        return this;
    }

    /** Nav2 gave up: no live goal, and the last one ended aborted. */
    DispatchFixture nav2Aborted(int robotId) {
        navigating.put(robotId, false);
        goalFailed.put(robotId, true);
        return this;
    }

    DispatchFixture rosbridgeDown() {
        rosbridgeConnected = false;
        return this;
    }

    // ── time ─────────────────────────────────────────────────────────────────

    DispatchFixture advance(Duration by) {
        clock.advance(by);
        return this;
    }

    /** One scheduler tick. */
    DispatchFixture tick() {
        service.tick();
        return this;
    }

    /**
     * Ticks at the real poll interval for a stretch of time.
     * <p>
     * Recovery is deliberately unhurried — a grace window, then a deadline, then
     * another attempt — so several behaviours only appear after many ticks. Stepping
     * at the interval the scheduler actually uses keeps these tests honest about how
     * long that takes.
     */
    DispatchFixture run(Duration duration) {
        long ticks = duration.toMillis() / POLL_INTERVAL.toMillis();

        for (long i = 0; i < ticks; i++) {
            service.tick();
            clock.advance(POLL_INTERVAL);
        }

        return this;
    }

    // ── what happened ────────────────────────────────────────────────────────

    /** Drop points a robot was sent to, oldest first, including repeats. */
    List<String> destinationsSentTo(int robotId) {
        return publishedGoals.stream()
                .filter(goal -> goal.robotId() == robotId)
                .map(PublishedGoal::destination)
                .collect(Collectors.toList());
    }

    List<PublishedGoal> publishedGoals() {
        return List.copyOf(publishedGoals);
    }

    List<RobotUpdate> robotUpdates() {
        return List.copyOf(robotUpdates);
    }

    /** Warnings the pipeline logged. A recovery that says nothing is half a recovery. */
    List<String> warnings() {
        synchronized (LOG_RECORDS) {
            return LOG_RECORDS.subList(logMark, LOG_RECORDS.size()).stream()
                    .filter(record -> record.getLevel().intValue()
                            >= Level.WARNING.intValue())
                    .map(LogRecord::getMessage)
                    .collect(Collectors.toList());
        }
    }

    /** Current status of an order, as DynamoDB would hold it. */
    String orderStatus(String orderId) {
        return orders.stream()
                .filter(order -> orderId.equals(order.get("orderId")))
                .map(order -> String.valueOf(order.get("orderStatus")))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("no such order: " + orderId));
    }

    Optional<DispatchAssignment> assignmentFor(String orderId) {
        return service.assignments().stream()
                .filter(assignment -> assignment.orderId().equals(orderId))
                .findFirst();
    }

    Optional<DispatchAssignment> assignmentHeldBy(int robotId) {
        return service.assignments().stream()
                .filter(assignment -> assignment.robotId() == robotId)
                .findFirst();
    }

    /** Distance from a robot's reported position to a drop point, in metres. */
    double metresFrom(int robotId, String dropPointId) {
        RobotService.Position position = positions.get(robotId);
        DropPointMap.DropPoint point = point(dropPointId);
        return Math.hypot(position.x() - point.x(), position.y() - point.y());
    }

    DropPointMap.DropPoint point(String dropPointId) {
        return dropPointService.find(dropPointId).orElseThrow(
                () -> new IllegalArgumentException("no such drop point: " + dropPointId));
    }

    // ── wiring ───────────────────────────────────────────────────────────────

    private static DropPointService loadRealDropPoints() {
        try {
            DropPointService service = new DropPointService(
                    new ObjectMapper(), new ClassPathResource("drop-points.json"));
            service.load();
            return service;
        } catch (IOException exception) {
            // Same guard DropPointServiceTest relies on: the file is generated.
            throw new UncheckedIOException(
                    "run map-source/stage-map-assets.sh", exception);
        }
    }

    private void stubCollaborators() {
        Mockito.when(orderService.getOrders())
                .thenAnswer(invocation -> new ArrayList<>(orders));

        Mockito.when(orderService.updateStatus(
                        ArgumentMatchers.anyString(), ArgumentMatchers.any()))
                .thenAnswer(invocation -> {
                    String orderId = invocation.getArgument(0);
                    OrderStatus status = invocation.getArgument(1);

                    for (Map<String, Object> order : orders) {
                        if (orderId.equals(order.get("orderId"))) {
                            order.put("orderStatus", status.getValue());
                            return Optional.of(order);
                        }
                    }

                    return Optional.empty();
                });

        Mockito.when(robotService.getFreshRobotIds())
                .thenAnswer(invocation -> new ArrayList<>(freshRobots));

        Mockito.when(robotService.getPosition(ArgumentMatchers.anyInt()))
                .thenAnswer(invocation ->
                        Optional.ofNullable(positions.get(invocation.<Integer>getArgument(0))));

        Mockito.when(robotService.isFresh(ArgumentMatchers.anyInt()))
                .thenAnswer(invocation ->
                        freshRobots.contains(invocation.<Integer>getArgument(0)));

        Mockito.doAnswer(invocation -> {
            robotUpdates.add(new RobotUpdate(
                    invocation.getArgument(0),
                    invocation.getArgument(1),
                    invocation.getArgument(2),
                    invocation.getArgument(3)));
            return null;
        }).when(robotService).setAssignment(
                ArgumentMatchers.anyInt(),
                ArgumentMatchers.any(),
                ArgumentMatchers.any(),
                ArgumentMatchers.any());

        Mockito.when(rosBridgeService.isConnected())
                .thenAnswer(invocation -> rosbridgeConnected);

        Mockito.when(rosBridgeService.isNavigating(ArgumentMatchers.anyInt()))
                .thenAnswer(invocation ->
                        navigating.getOrDefault(invocation.<Integer>getArgument(0), false));

        Mockito.when(rosBridgeService.lastGoalFailed(ArgumentMatchers.anyInt()))
                .thenAnswer(invocation ->
                        goalFailed.getOrDefault(invocation.<Integer>getArgument(0), false));

        try {
            Mockito.doAnswer(invocation -> {
                int robotId = invocation.getArgument(0);
                double x = invocation.getArgument(1);
                double y = invocation.getArgument(2);
                publishedGoals.add(new PublishedGoal(robotId, dropPointAt(x, y)));
                return null;
            }).when(rosBridgeService).publishGoal(
                    ArgumentMatchers.anyInt(),
                    ArgumentMatchers.anyDouble(),
                    ArgumentMatchers.anyDouble(),
                    ArgumentMatchers.anyDouble());
        } catch (Exception exception) {
            throw new IllegalStateException(exception);
        }
    }

    /** Names the goal that was published, so assertions read "T3" not "(18.128, 9.241)". */
    private String dropPointAt(double x, double y) {
        return dropPointService.all().stream()
                .filter(point -> Math.hypot(point.x() - x, point.y() - y) < 1e-6)
                .map(DropPointMap.DropPoint::id)
                .findFirst()
                .orElse("(%s, %s)".formatted(x, y));
    }

    /** Installs the shared handler once; returns where this fixture's records start. */
    private static synchronized int installLogCapture() {
        if (!logHandlerInstalled) {
            Logger.getLogger(DispatchService.class.getName()).addHandler(new Handler() {
                @Override
                public void publish(LogRecord record) {
                    synchronized (LOG_RECORDS) {
                        LOG_RECORDS.add(record);
                    }
                }

                @Override
                public void flush() { }

                @Override
                public void close() { }
            });
            logHandlerInstalled = true;
        }

        synchronized (LOG_RECORDS) {
            return LOG_RECORDS.size();
        }
    }
}
