package com.dishpatch.dispatch;

import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * The counter invariant, and getting robots back to it.
 *
 * <p>A robot is only assignable while parked at the counter, so any robot the
 * pipeline has not itself placed there is driven home first. That homing trip is
 * the one journey nobody is watching: a homing robot carries no order, so if its
 * goal dies it simply never becomes assignable again, and no delivery is late, no
 * order is stuck, and nothing complains. It just quietly stops being part of the
 * fleet.
 */
class DispatchHomingTest {

    @Test
    void homesARobotThatIsNotAtTheCounter() {
        DispatchFixture fixture = new DispatchFixture().robotAt(1, "T5");

        fixture.tick();

        assertEquals(List.of("counter"), fixture.destinationsSentTo(1));
        assertTrue(fixture.service.freeRobotIds().isEmpty(),
                "not assignable until its position says it got there");

        fixture.moveTo(1, "counter").nav2Idle(1).tick();

        assertEquals(List.of(1), fixture.service.freeRobotIds());
    }

    @Test
    void adoptsARobotAlreadyParkedAtTheCounter() {
        DispatchFixture fixture = new DispatchFixture().robotAtCounter(1);

        fixture.tick();

        assertTrue(fixture.destinationsSentTo(1).isEmpty(),
                "no point commanding it to where it already is");
        assertEquals(List.of(1), fixture.service.freeRobotIds());
    }

    @Test
    void resendsAHomingGoalThatDied() {
        DispatchFixture fixture = new DispatchFixture().robotAt(1, "T5");

        fixture.tick();
        fixture.nav2Aborted(1);
        fixture.advance(Duration.ofSeconds(6)).tick();

        assertEquals(List.of("counter", "counter"), fixture.destinationsSentTo(1));
        assertTrue(
                fixture.warnings().stream()
                        .anyMatch(warning -> warning.contains("stopped short of counter")),
                "a robot quietly dropping out of the fleet should say something: "
                        + fixture.warnings());
    }

    @Test
    void doesNotResendAHomingGoalWhileNav2IsDriving() {
        DispatchFixture fixture = new DispatchFixture().robotAt(1, "T5");

        fixture.tick();
        fixture.nav2Driving(1);
        fixture.run(Duration.ofSeconds(30));

        assertEquals(List.of("counter"), fixture.destinationsSentTo(1),
                "re-sending here would preempt a goal that is working");
    }

    @Test
    void forgetsRobotsThatGoSilent() {
        // A robot that stopped reporting cannot be trusted to still be parked, so it
        // homes again on its return rather than being handed an order on faith.
        DispatchFixture fixture = new DispatchFixture().robotAtCounter(1);

        fixture.tick();
        assertEquals(List.of(1), fixture.service.freeRobotIds());

        fixture.robotWentSilent(1).tick();
        assertTrue(fixture.service.freeRobotIds().isEmpty());

        fixture.robotAt(1, "T5").tick();

        assertEquals(List.of("counter"), fixture.destinationsSentTo(1),
                "it comes back somewhere unknown, so it is homed again");
        assertTrue(fixture.service.freeRobotIds().isEmpty());
    }

    @Test
    void aRobotIsNeverBothFreeAndBusy() {
        // The property that, had it held, would have prevented the outage: a robot is
        // either carrying a delivery or available, and never permanently neither.
        DispatchFixture fixture = new DispatchFixture()
                .robotAtCounter(1)
                .robotAtCounter(2)
                .pendingOrder("o-1", "T3")
                .pendingOrder("o-2", "T9");

        for (int i = 0; i < 180; i++) {
            fixture.tick();
            fixture.advance(Duration.ofSeconds(1));

            // Nav2 is having a bad day throughout.
            fixture.nav2Aborted(1).nav2Aborted(2);

            Set<Integer> busy = fixture.service.assignments().stream()
                    .map(DispatchAssignment::robotId)
                    .collect(Collectors.toSet());

            for (Integer free : fixture.service.freeRobotIds()) {
                assertFalse(busy.contains(free),
                        "robot " + free + " was both free and mid-delivery on tick " + i);
            }
        }

        assertFalse(fixture.warnings().isEmpty(),
                "three minutes of failing navigation should not pass in silence");
    }
}
