package com.dishpatch.dispatch;

import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * How orders become deliveries.
 *
 * <p>None of this is new — it is the behaviour the pipeline shipped with, and none
 * of it had a test. The rules it encodes are easy to break by accident and hard to
 * notice: orders are FIFO by {@code orderDate} because DynamoDB is the queue, and a
 * robot may only be given an order while parked at the counter, because that is
 * where the meal is.
 */
class DispatchAssignmentTest {

    @Test
    void assignsTheOldestPendingOrderFirst() {
        // DynamoDB is the queue; sorting by orderDate each tick is what makes it FIFO.
        DispatchFixture fixture = new DispatchFixture()
                .robotAtCounter(1)
                .pendingOrder("older", "T6")
                .pendingOrder("newer", "T7");

        fixture.tick();

        assertTrue(fixture.assignmentFor("older").isPresent());
        assertTrue(fixture.assignmentFor("newer").isEmpty(),
                "only one robot was free, so the newer order waits");
    }

    @Test
    void onlyAssignsRobotsParkedAtTheCounter() {
        // The counter invariant: idle is not enough, it has to be idle *there*.
        DispatchFixture fixture = new DispatchFixture()
                .robotAt(1, "T5")
                .pendingOrder("o-1", "T6");

        fixture.tick();

        assertTrue(fixture.service.assignments().isEmpty(),
                "a robot standing out on the floor has no meal to carry");
        assertEquals(List.of("counter"), fixture.destinationsSentTo(1),
                "it gets sent to the counter first");
        assertEquals(1, fixture.service.queuedOrders());
    }

    @Test
    void countsOrdersItCouldNotPlaceAsQueued() {
        // Queued with no free robot is load, not a bug — the endpoint reports it so
        // the two can be told apart.
        DispatchFixture fixture = new DispatchFixture()
                .robotAtCounter(1)
                .pendingOrder("o-1", "T6")
                .pendingOrder("o-2", "T7")
                .pendingOrder("o-3", "T8");

        fixture.tick();

        assertEquals(1, fixture.service.assignments().size());
        assertEquals(2, fixture.service.queuedOrders());
    }

    @Test
    void doesNotConsumeARobotWhenRosbridgeIsDown() {
        DispatchFixture fixture = new DispatchFixture()
                .robotAtCounter(1)
                .pendingOrder("o-1", "T6")
                .rosbridgeDown();

        fixture.tick();

        assertTrue(fixture.service.assignments().isEmpty());
        assertEquals(1, fixture.service.queuedOrders());
        assertEquals(List.of(1), fixture.service.freeRobotIds(),
                "the robot is still free — nothing was asked of it");
    }

    @Test
    void skipsAnOrderWithNoTable() {
        DispatchFixture fixture = new DispatchFixture()
                .robotAtCounter(1)
                .pendingOrderWithoutTable("o-1");

        fixture.tick();

        assertEquals("Order has no table", fixture.service.skipped().get("o-1"));
        assertTrue(fixture.service.assignments().isEmpty());
    }

    @Test
    void skipsAnUnknownDestination() {
        // Distinct from queued: no robot arriving later makes T99 deliverable.
        DispatchFixture fixture = new DispatchFixture()
                .robotAtCounter(1)
                .pendingOrder("o-1", "T99");

        fixture.tick();

        assertEquals("Unknown destination: T99", fixture.service.skipped().get("o-1"));
        assertEquals(0, fixture.service.queuedOrders());
    }

    @Test
    void dropsSkippedOrdersOnceTheyLeavePreparing() {
        // Otherwise the skip list grows for the life of the process.
        DispatchFixture fixture = new DispatchFixture()
                .robotAtCounter(1)
                .pendingOrder("o-1", "T99");

        fixture.tick();
        assertTrue(fixture.service.skipped().containsKey("o-1"));

        fixture.orderLeftPreparing("o-1").tick();

        assertFalse(fixture.service.skipped().containsKey("o-1"),
                "an order that is no longer pending cannot still be skipped");
    }

    @Test
    void doesNotAssignAnOrderAlreadyInFlight() {
        // Orders stay Preparing until delivery completes, so without this guard a
        // fresh robot would be handed the same order every tick.
        DispatchFixture fixture = new DispatchFixture()
                .robotAtCounter(1)
                .pendingOrder("o-1", "T6");

        fixture.tick();
        fixture.tick();

        assertEquals(1, fixture.service.assignments().size());
        assertEquals(List.of("T6"), fixture.destinationsSentTo(1),
                "one order, one goal");
    }

    @Test
    void completesTheOrderAndSendsTheRobotBackAfterTheServeDwell() {
        DispatchFixture fixture = new DispatchFixture()
                .robotAtCounter(1)
                .pendingOrder("o-1", "T6");

        fixture.tick();
        fixture.moveTo(1, "T6").nav2Idle(1).tick();

        assertEquals(DispatchState.AT_TABLE,
                fixture.assignmentFor("o-1").orElseThrow().state());
        assertEquals("Preparing", fixture.orderStatus("o-1"));

        fixture.advance(Duration.ofSeconds(3)).tick();

        assertEquals("Preparing", fixture.orderStatus("o-1"),
                "the dwell is serving time, and it is not over");

        fixture.advance(Duration.ofSeconds(3)).tick();

        assertEquals("Completed", fixture.orderStatus("o-1"));
        assertEquals(DispatchState.RETURNING,
                fixture.assignmentFor("o-1").orElseThrow().state());
        assertEquals(List.of("T6", "counter"), fixture.destinationsSentTo(1));
    }
}
