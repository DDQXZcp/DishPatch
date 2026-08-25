package com.dishpatch.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.socket.TextMessage;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * How {@link RosBridgeService} reads Nav2's action status topic.
 *
 * <p>This is the seam the dispatch package cannot see. Every test in
 * {@code DispatchFixture} stubs {@code isNavigating} and {@code lastGoalFailed}
 * with a boolean the test chose, so all 27 of them encode our <em>belief</em>
 * about what Nav2 reports rather than what it reports. If the parsing below is
 * wrong, the entire dispatch suite still passes and the fleet still stops. The
 * 2026-08-11 stall arrived through exactly this gap.
 *
 * <p>Driven through {@code handleTextMessage} with real rosbridge frames, so
 * these assert the wire format rather than a Java method call. No session is
 * needed: the nav-status branch returns before anything is sent, and before
 * {@code robotService} — which is field-injected and null here — is touched.
 *
 * <p>Status values are {@code action_msgs/msg/GoalStatus}.
 */
class RosBridgeNavStatusTest {

    private static final int ACCEPTED = 1;
    private static final int EXECUTING = 2;
    private static final int CANCELING = 3;
    private static final int SUCCEEDED = 4;
    private static final int CANCELED = 5;
    private static final int ABORTED = 6;

    private RosBridgeService service;

    @BeforeEach
    void setUp() {
        service = new RosBridgeService();
    }

    /** A publish frame on a robot's navigate_to_pose status topic. */
    private void navStatus(int robotId, int... statuses) {
        StringBuilder list = new StringBuilder();

        for (int i = 0; i < statuses.length; i++) {
            if (i > 0) {
                list.append(",");
            }
            // goal_info is carried by the real message and ignored by the parser;
            // including it keeps these frames honest about what arrives.
            list.append("{\"goal_info\":{\"goal_id\":{\"uuid\":[").append(i)
                    .append("]},\"stamp\":{\"sec\":0,\"nanosec\":0}},\"status\":")
                    .append(statuses[i]).append("}");
        }

        receive("{\"op\":\"publish\",\"topic\":\"/robot" + robotId
                + "/navigate_to_pose/_action/status\","
                + "\"msg\":{\"status_list\":[" + list + "]}}");
    }

    private void receive(String payload) {
        service.handleTextMessage(null, new TextMessage(payload));
    }

    // ── nothing heard yet ────────────────────────────────────────────────────

    @Test
    void reportsNeitherLiveNorFailedBeforeAnyStatusArrives() {
        // The dispatcher reads both on its first tick, before Nav2 has said
        // anything. Neither may read as true, or a fresh robot looks like it is
        // already driving, or like its goal already failed.
        assertFalse(service.isNavigating(1));
        assertFalse(service.lastGoalFailed(1));
    }

    @Test
    void anEmptyStatusListMeansNav2HoldsNothing() {
        navStatus(1);

        assertFalse(service.isNavigating(1));
        assertFalse(service.lastGoalFailed(1));
    }

    // ── a goal in flight ─────────────────────────────────────────────────────

    @Test
    void anAcceptedGoalIsLive() {
        navStatus(1, ACCEPTED);

        assertTrue(service.isNavigating(1),
                "an accepted goal is one the dispatcher must not preempt");
    }

    @Test
    void anExecutingGoalIsLive() {
        navStatus(1, EXECUTING);

        assertTrue(service.isNavigating(1));
    }

    @Test
    void aCancelingGoalIsNotLive() {
        // CANCELING is not in the accepted/executing pair, so the robot is not
        // considered to be driving. Worth pinning: it is the one non-terminal
        // status that reads as idle.
        navStatus(1, CANCELING);

        assertFalse(service.isNavigating(1));
    }

    // ── goals that ended ─────────────────────────────────────────────────────

    @Test
    void aSucceededGoalIsNeitherLiveNorFailed() {
        navStatus(1, SUCCEEDED);

        assertFalse(service.isNavigating(1));
        assertFalse(service.lastGoalFailed(1),
                "arriving is not a failure; treating it as one re-sends a goal "
                        + "at a robot that already got there");
    }

    @Test
    void anAbortedGoalIsTheFailureThatStrandedTheFleet() {
        // 2026-08-11: Nav2 aborted the goal milliseconds after accepting it. This
        // pair of booleans is the entire signal DispatchService recovers from.
        navStatus(1, ABORTED);

        assertFalse(service.isNavigating(1));
        assertTrue(service.lastGoalFailed(1));
    }

    @Test
    void aCancelledGoalCountsAsFailed() {
        navStatus(1, CANCELED);

        assertFalse(service.isNavigating(1));
        assertTrue(service.lastGoalFailed(1));
    }

    // ── the retained array ───────────────────────────────────────────────────

    @Test
    void readsTheLastEntryAsTheNewest() {
        // Nav2 retains terminal goals and appends, so the array is a history and
        // only its tail is current. An earlier abort must not outlive the goal
        // that came after it — the dispatcher would give up on a live delivery.
        navStatus(1, ABORTED, ACCEPTED);

        assertTrue(service.isNavigating(1));
        assertFalse(service.lastGoalFailed(1),
                "the abort is history; the newest goal was accepted");
    }

    @Test
    void staysLiveWhileAnyGoalIsActiveEvenIfTheNewestFailed() {
        // The two fields answer different questions and can disagree: something is
        // still executing, while the most recent entry is a failure. This is why
        // lastGoalFailed is documented as meaningful only when isNavigating is
        // false, and the pairing is worth pinning rather than assuming.
        navStatus(1, ACCEPTED, ABORTED);

        assertTrue(service.isNavigating(1));
        assertTrue(service.lastGoalFailed(1));
    }

    @Test
    void handlesAnArrayOfNothingButRetainedTerminalGoals() {
        // What the topic looks like after a busy spell — the shape that grew past
        // the 8 KB receive buffer in #68.
        navStatus(1, SUCCEEDED, SUCCEEDED, ABORTED, SUCCEEDED);

        assertFalse(service.isNavigating(1));
        assertFalse(service.lastGoalFailed(1),
                "the newest goal succeeded, whatever happened earlier");
    }

    // ── more than one robot ──────────────────────────────────────────────────

    @Test
    void tracksEachRobotSeparately() {
        navStatus(1, ABORTED);
        navStatus(2, EXECUTING);

        assertFalse(service.isNavigating(1));
        assertTrue(service.lastGoalFailed(1));

        assertTrue(service.isNavigating(2));
        assertFalse(service.lastGoalFailed(2));
    }

    @Test
    void aLaterFrameReplacesTheEarlierVerdict() {
        navStatus(1, EXECUTING);
        assertTrue(service.isNavigating(1));

        navStatus(1, ABORTED);

        assertFalse(service.isNavigating(1),
                "the robot stopped driving; a stale true here freezes the delivery");
        assertTrue(service.lastGoalFailed(1));
    }

    // ── bad input ────────────────────────────────────────────────────────────

    @Test
    void aMalformedFrameIsSwallowedAndLeavesTheVerdictAlone() {
        // handleTextMessage catches and logs. What matters is that a junk frame
        // cannot flip a robot's state — the rosbridge link carries whatever the
        // graph publishes, and one bad message must not strand a delivery.
        navStatus(1, EXECUTING);

        receive("{\"op\":\"publish\",\"topic\":\"/robot1"
                + "/navigate_to_pose/_action/status\",\"msg\":{}}");

        assertTrue(service.isNavigating(1),
                "the last good frame should still stand");
    }
}
