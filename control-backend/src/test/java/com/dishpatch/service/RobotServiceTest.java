package com.dishpatch.service;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Telemetry in, and the two questions the dispatcher asks of it.
 *
 * <p>{@code DispatchService} treats this class as its source of truth for where a
 * robot is and whether it is still alive, and every dispatch test stubs both. The
 * real implementations are here: position comes out of a RobotStatus message, and
 * liveness is a 20-second window since the last one.
 *
 * <p>The freshness window is the load-bearing half. A robot wrongly judged fresh
 * is handed an order it will never deliver; wrongly judged stale, it drops out of
 * the fleet. {@code isFreshAt} takes the current time as an argument, so the
 * boundary is exercised here rather than waited out.
 *
 * <p>{@code messagingTemplate} is field-injected, so a bare {@code new
 * RobotService()} leaves it null and every path through {@code broadcast()} would
 * NPE. Set reflectively rather than changing the class — constructor injection
 * would be the better fix, and is a separate change.
 */
class RobotServiceTest {

    /** The expiry the class enforces. A literal, so shortening it fails here. */
    private static final long EXPIRY_MILLIS = 20_000L;

    private RobotService service;
    private SimpMessagingTemplate messagingTemplate;

    @BeforeEach
    void setUp() {
        service = new RobotService();
        messagingTemplate = Mockito.mock(SimpMessagingTemplate.class);
        ReflectionTestUtils.setField(service, "messagingTemplate", messagingTemplate);
    }

    /** A RobotStatus message as rosbridge delivers it. */
    private static JsonObject status(double x, double y, double z, double w) {
        return JsonParser.parseString("""
                {
                  "battery": 82,
                  "speed": 0.35,
                  "pose": {
                    "position": { "x": %s, "y": %s, "z": 0.0 },
                    "orientation": { "x": 0.0, "y": 0.0, "z": %s, "w": %s }
                  }
                }
                """.formatted(x, y, z, w)).getAsJsonObject();
    }

    private static JsonObject statusAt(double x, double y) {
        return status(x, y, 0.0, 1.0);
    }

    // ── telemetry in ─────────────────────────────────────────────────────────

    @Test
    void createsARobotTheFirstTimeItReports() {
        service.updateField(7, "status", statusAt(1.0, 2.0));

        assertEquals(List.of(7),
                service.getAllRobots().stream().map(r -> r.getId()).toList());
        assertEquals("Robot 7", service.getAllRobots().get(0).getName());
    }

    @Test
    void readsThePositionTheDispatcherMeasuresDistancesFrom() {
        service.updateField(1, "status", statusAt(18.128, 9.241));

        RobotService.Position position = service.getPosition(1).orElseThrow();

        assertEquals(18.128, position.x());
        assertEquals(9.241, position.y());
    }

    @Test
    void hasNoPositionForARobotThatHasNeverReported() {
        assertTrue(service.getPosition(99).isEmpty());
    }

    @Test
    void recoversHeadingFromTheQuaternion() {
        // The fleet is planar, so yaw = 2*atan2(z, w) is exact. A quarter turn is
        // z = sin(pi/4), w = cos(pi/4).
        double halfAngle = Math.PI / 4;
        service.updateField(1, "status",
                status(0.0, 0.0, Math.sin(halfAngle), Math.cos(halfAngle)));

        assertEquals(Math.PI / 2, service.getAllRobots().get(0).getYaw(), 1e-9);
    }

    @Test
    void readsBatteryAndSpeed() {
        service.updateField(1, "status", statusAt(0.0, 0.0));

        assertEquals(82, service.getAllRobots().get(0).getBattery());
        assertEquals(0.35f, service.getAllRobots().get(0).getSpeed(), 1e-6);
    }

    @Test
    void aLaterReportMovesTheSameRobotRatherThanAddingOne() {
        service.updateField(1, "status", statusAt(1.0, 1.0));
        service.updateField(1, "status", statusAt(5.0, 6.0));

        assertEquals(1, service.getAllRobots().size());
        assertEquals(5.0, service.getPosition(1).orElseThrow().x());
    }

    // ── the freshness window ─────────────────────────────────────────────────

    @Test
    void aRobotIsFreshRightAfterItReports() {
        service.updateField(1, "status", statusAt(0.0, 0.0));

        assertTrue(service.isFresh(1));
        assertEquals(List.of(1), service.getFreshRobotIds());
    }

    @Test
    void aRobotThatHasNeverReportedIsNotFresh() {
        // Distinct from stale: there is no timestamp at all. A null here must not
        // read as "updated at epoch zero" or as fresh.
        assertFalse(service.isFresh(99));
        assertFalse(service.isFreshAt(99, System.currentTimeMillis()));
        assertTrue(service.getFreshRobotIds().isEmpty());
    }

    @Test
    void staysFreshUntilTheWindowIsUp() {
        long before = System.currentTimeMillis();
        service.updateField(1, "status", statusAt(0.0, 0.0));
        long after = System.currentTimeMillis();

        // The stamp lies somewhere in [before, after], so bracketing keeps this
        // exact without controlling the clock.
        assertTrue(service.isFreshAt(1, after),
                "fresh the moment it reported");
        assertTrue(service.isFreshAt(1, before + EXPIRY_MILLIS - 1_000),
                "still fresh a second short of the window");
    }

    @Test
    void goesStaleOnceTheWindowPasses() {
        service.updateField(1, "status", statusAt(0.0, 0.0));
        long after = System.currentTimeMillis();

        assertFalse(service.isFreshAt(1, after + EXPIRY_MILLIS),
                "the window is exclusive at its far end");
        assertFalse(service.isFreshAt(1, after + EXPIRY_MILLIS + 60_000));
    }

    @Test
    void listsEveryRobotInsideTheWindow() {
        service.updateField(1, "status", statusAt(0.0, 0.0));
        service.updateField(2, "status", statusAt(1.0, 1.0));
        long after = System.currentTimeMillis();

        assertEquals(List.of(1, 2), service.getFreshRobotIds(),
                "both reported just now");

        // And neither survives the window. getFreshRobotIds reads the wall clock
        // itself, so the expiry is checked through isFreshAt.
        assertFalse(service.isFreshAt(1, after + EXPIRY_MILLIS));
        assertFalse(service.isFreshAt(2, after + EXPIRY_MILLIS));
    }

    // ── what the dispatcher writes back ──────────────────────────────────────

    @Test
    void recordsAnAssignment() {
        service.updateField(1, "status", statusAt(0.0, 0.0));

        service.setAssignment(1, RobotService.STATUS_SERVING, "T6", "o-1");

        var robot = service.getAllRobots().get(0);
        assertEquals(RobotService.STATUS_SERVING, robot.getStatus());
        assertEquals("T6", robot.getDestination());
        assertEquals("o-1", robot.getOrderId());
    }

    @Test
    void ignoresAnAssignmentForARobotThatHasNotReported() {
        // The dispatcher can name a robot the graph knows about but that has sent
        // no telemetry yet. That must not invent one.
        service.setAssignment(42, RobotService.STATUS_SERVING, "T6", "o-1");

        assertTrue(service.getAllRobots().isEmpty());
    }

    // ── the frontend push ────────────────────────────────────────────────────

    @Test
    void pushesToTheFrontendOnEachTick() {
        // The map goes blank when these stop, which is how #68 first showed itself.
        service.updateField(1, "status", statusAt(0.0, 0.0));
        service.broadcastRobots();

        Mockito.verify(messagingTemplate)
                .convertAndSend(Mockito.eq("/topic/robot-locations"), Mockito.<Object>any());
        Mockito.verify(messagingTemplate)
                .convertAndSend(Mockito.eq("/topic/robot-stats"), Mockito.<Object>any());
    }

    @Test
    void doesNotPushFromTheTelemetryCallback() {
        // scale with fleet size, outrunning the map's marker interpolation.
        service.updateField(1, "status", statusAt(0.0, 0.0));
        service.setAssignment(1, RobotService.STATUS_SERVING, "T6", "o-1");

        Mockito.verifyNoInteractions(messagingTemplate);
    }

    @Test
    void keepsPushingWhenNoTelemetryArrives() {
        service.broadcastRobots();
        service.broadcastRobots();

        Mockito.verify(messagingTemplate, Mockito.times(2))
                .convertAndSend(Mockito.eq("/topic/robot-locations"), Mockito.<Object>any());
    }

    @Test
    void countsTheFleetByStatusForTheDashboard() {
        service.updateField(1, "status", statusAt(0.0, 0.0));
        service.updateField(2, "status", statusAt(1.0, 1.0));
        service.setAssignment(1, RobotService.STATUS_SERVING, "T6", "o-1");
        service.broadcastRobots(); // stats are recomputed on the tick, not per message

        assertEquals(1L, service.getStats().get("serving"));
        assertEquals(1L, service.getStats().get("waiting"),
                "robot 2 is still on the status it was created with");
        assertEquals(2, service.getStats().get("total"));
    }
}
