package com.dishpatch.dispatch;

import com.dishpatch.order.OrderStatus;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentMatchers;
import org.mockito.Mockito;

import java.time.Duration;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * What the pipeline does when a navigation goal does not work out.
 *
 * <p>On 2026-08-11 Nav2 aborted two goals a few milliseconds after receiving them.
 * The robots stopped where they stood, and because a driving stage had exactly one
 * way out — arrive — those two deliveries never ended. Each robot stayed marked
 * busy, which excluded it from the homing pass that would otherwise have rescued
 * it, and every code path involved was a success path, so nothing was logged at all.
 * The fleet halved, then stopped.
 *
 * <p>Two of these tests assert that <em>no</em> goal is published. They matter as
 * much as the rest: re-sending while Nav2 still holds a goal is a preemption, and
 * self-preemption is a pathology this fleet already had. A recovery that fixes the
 * stall by causing preemptions has traded one bug for another.
 */
class DispatchRecoveryTest {

    // ── the robot must be left alone ─────────────────────────────────────────

    @Test
    void concludesNothingAboutNav2SilenceInsideTheGraceWindow() {
        // A goal crosses a WebSocket to another host before Nav2 reports it live.
        // Reading anything into that gap would re-send on top of a goal already on
        // its way.
        DispatchFixture fixture = new DispatchFixture()
                .robotAtCounter(1)
                .pendingOrder("o-1", "T3");

        fixture.tick();
        fixture.nav2Idle(1).moveTo(1, "T4");
        fixture.run(Duration.ofSeconds(5));

        assertEquals(List.of("T3"), fixture.destinationsSentTo(1),
                "a second goal inside the grace window would preempt the first");
    }

    @Test
    void neverResendsWhileNav2IsStillDriving() {
        DispatchFixture fixture = new DispatchFixture()
                .robotAtCounter(1)
                .pendingOrder("o-1", "T3");

        fixture.tick();
        fixture.moveTo(1, "T4").nav2Driving(1);
        fixture.run(Duration.ofSeconds(60));

        assertEquals(List.of("T3"), fixture.destinationsSentTo(1),
                "Nav2 holds a live goal, so the robot is on its way");
    }

    // ── recovering a lost goal ───────────────────────────────────────────────

    @Test
    void resendsAGoalNav2NoLongerHolds() {
        DispatchFixture fixture = new DispatchFixture()
                .robotAtCounter(1)
                .pendingOrder("o-1", "T3");

        fixture.tick();
        fixture.moveTo(1, "T4").nav2Idle(1);
        fixture.advance(Duration.ofSeconds(6)).tick();

        assertEquals(List.of("T3", "T3"), fixture.destinationsSentTo(1));
        assertEquals(2, fixture.assignmentFor("o-1").orElseThrow().attempts());
    }

    @Test
    void resendsWhenNav2ReportsTheGoalAborted() {
        DispatchFixture fixture = new DispatchFixture()
                .robotAtCounter(1)
                .pendingOrder("o-1", "T3");

        fixture.tick();
        fixture.moveTo(1, "T4").nav2Aborted(1);
        fixture.advance(Duration.ofSeconds(6)).tick();

        assertEquals(List.of("T3", "T3"), fixture.destinationsSentTo(1));
        assertTrue(
                fixture.warnings().stream()
                        .anyMatch(warning -> warning.contains("Nav2 aborted the goal")),
                "the abort is the news; it should say so: " + fixture.warnings());
    }

    @Test
    void sizesTheDeadlineByDistance() {
        // A flat timeout cannot serve both a 6m hop and a 30m run across the floor.
        DispatchFixture near = new DispatchFixture()
                .robotAtCounter(1)
                .pendingOrder("near", "T6");
        DispatchFixture far = new DispatchFixture()
                .robotAtCounter(1)
                .pendingOrder("far", "T1");

        near.tick();
        far.tick();

        long nearDeadline = near.assignmentFor("near").orElseThrow().deadlineMillis();
        long farDeadline = far.assignmentFor("far").orElseThrow().deadlineMillis();

        assertTrue(far.metresFrom(1, "T1") > near.metresFrom(1, "T6"),
                "T1 really is the longer trip");
        assertTrue(farDeadline > nearDeadline,
                "the longer trip should get the longer budget");
    }

    @Test
    void givesUpAfterTheAttemptCap() {
        DispatchFixture fixture = new DispatchFixture()
                .robotAtCounter(1)
                .pendingOrder("o-1", "T3");

        fixture.tick();
        fixture.moveTo(1, "T4").nav2Aborted(1);
        fixture.run(Duration.ofSeconds(20));

        assertTrue(fixture.assignmentHeldBy(1).isEmpty(),
                "the delivery must not hold the robot forever");
        assertTrue(fixture.destinationsSentTo(1).contains("counter"),
                "a robot it gives up on gets sent home");
    }

    // ── what giving up means for the order ───────────────────────────────────

    @Test
    void returnsTheOrderToTheQueueWhenItGivesUpBeforeDelivery() {
        DispatchFixture fixture = new DispatchFixture()
                .robotAtCounter(1)
                .pendingOrder("o-1", "T3");

        fixture.tick();
        fixture.moveTo(1, "T4").nav2Aborted(1);
        fixture.run(Duration.ofSeconds(20));

        assertEquals("Preparing", fixture.orderStatus("o-1"),
                "the meal never arrived, so the order is still owed");
        Mockito.verify(fixture.orderService, Mockito.never())
                .updateStatus(ArgumentMatchers.anyString(), ArgumentMatchers.any());

        // Still owed is not enough — it has to be deliverable again. Left in the
        // assignment map it would be neither delivered nor re-dispatchable, which is
        // the state both robots died in. Assert the journey, not just the end state:
        // a frozen delivery also "holds an assignment for T3", so only the trip home
        // and back tells the two apart.
        fixture.moveTo(1, "counter").nav2Idle(1).tick();

        List<String> goals = fixture.destinationsSentTo(1);

        assertTrue(goals.contains("counter"),
                "it should have been sent home when the delivery was given up: " + goals);
        assertEquals("T3", goals.get(goals.size() - 1),
                "and then picked the order up again: " + goals);
    }

    @Test
    void leavesTheOrderCompletedWhenItGivesUpOnTheWayBack() {
        DispatchFixture fixture = new DispatchFixture()
                .robotAtCounter(1)
                .pendingOrder("o-1", "T9");

        fixture.tick();
        fixture.moveTo(1, "T9").nav2Idle(1).tick();          // arrived, serving
        fixture.advance(Duration.ofSeconds(6)).tick();        // dwell over, heading back

        assertEquals("Completed", fixture.orderStatus("o-1"));

        fixture.nav2Aborted(1);                               // the trip home dies
        fixture.run(Duration.ofSeconds(20));

        assertTrue(fixture.assignmentHeldBy(1).isEmpty());
        assertEquals("Completed", fixture.orderStatus("o-1"),
                "the meal was delivered; only the robot was lost");
        Mockito.verify(fixture.orderService, Mockito.times(1))
                .updateStatus("o-1", OrderStatus.COMPLETED);
    }

    @Test
    void abandonsARobotStillNavigatingLongPastItsDeadline() {
        // Nav2 insists it is driving but the robot is going nowhere. Re-sending would
        // preempt a goal Nav2 believes in, so the only safe move is to give up.
        DispatchFixture fixture = new DispatchFixture()
                .robotAtCounter(1)
                .pendingOrder("o-1", "T3");

        fixture.tick();
        fixture.moveTo(1, "T4").nav2Driving(1);
        fixture.run(Duration.ofSeconds(70));

        assertTrue(fixture.assignmentHeldBy(1).isEmpty());
        assertEquals(List.of("T3", "counter"), fixture.destinationsSentTo(1),
                "it should give up, not fight Nav2 for the robot");
    }

    @Test
    void warnsOnEveryResendAndGiveUp() {
        // Silence is the failure mode this whole package exists to fix. A recovery
        // nobody can see is half a recovery.
        DispatchFixture fixture = new DispatchFixture()
                .robotAtCounter(1)
                .pendingOrder("o-1", "T3");

        fixture.tick();
        fixture.moveTo(1, "T4").nav2Aborted(1);
        fixture.run(Duration.ofSeconds(20));

        List<String> warnings = fixture.warnings();

        assertTrue(warnings.stream().anyMatch(w -> w.contains("stalled en route")),
                "expected a warning per re-send: " + warnings);
        assertTrue(warnings.stream().anyMatch(w -> w.contains("Giving up on order")),
                "expected a warning when it gives up: " + warnings);
    }

    // ── the incident ─────────────────────────────────────────────────────────

    @Test
    void anAbortedGoalDoesNotStrandTheRobotForever() {
        // 2026-08-11, reproduced. Robot 1 takes an order for T3, Nav2 aborts the goal,
        // and the robot never moves again. Before the fix this froze the delivery
        // permanently and silently, and every later order piled onto the other robot.
        DispatchFixture fixture = new DispatchFixture()
                .robotAtCounter(1)
                .pendingOrder("o-1", "T3");

        fixture.tick();
        fixture.moveTo(1, "T4").nav2Aborted(1);
        fixture.run(Duration.ofSeconds(20));

        assertTrue(fixture.assignmentHeldBy(1).isEmpty(),
                "the robot is no longer held by a delivery that cannot finish");
        assertTrue(fixture.destinationsSentTo(1).contains("counter"),
                "it was told to come home");
        assertFalse(fixture.warnings().isEmpty(),
                "and it was not silent about any of it");
        assertEquals("Preparing", fixture.orderStatus("o-1"),
                "the order is back in the queue for whoever is free next");

        // Once it actually gets home it is back in service, not written off.
        fixture.moveTo(1, "counter").nav2Idle(1).tick();

        assertTrue(fixture.assignmentHeldBy(1).isPresent(),
                "back at the counter, it should be carrying the order again");
    }
}
