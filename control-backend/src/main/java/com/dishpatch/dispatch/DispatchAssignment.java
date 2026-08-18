package com.dishpatch.dispatch;

/**
 * One in-flight delivery: which robot is carrying which order, and where to.
 * <p>
 * Immutable on purpose. {@link DispatchService} mutates on the scheduler thread
 * while {@link DispatchController} reads on a request thread, so a transition
 * replaces the whole record in the map rather than editing one in place. A reader
 * then sees either the old stage or the new one, never a new state paired with an
 * old deadline.
 * <p>
 * Internal only. {@code deadlineMillis} is absolute and deliberately never leaves
 * the backend; the API exposes time remaining instead.
 *
 * @param orderId        DynamoDB partition key of the order being delivered
 * @param robotId        robot id, matching the {@code /robot{id}} ROS namespace
 * @param destination    drop point id this job is currently headed to
 * @param state          current stage
 * @param deadlineMillis wall clock at which this stage runs out of patience. On
 *                       {@link DispatchState#AT_TABLE} that is the end of the serve
 *                       dwell; on the driving stages it is the point past which the
 *                       robot should have arrived, and has not
 * @param attempts       how many times the goal for the current stage has been
 *                       published — 1 on entry, incremented by each re-send
 * @param goalPublishedAtMillis wall clock of the most recent goal publish for this
 *                       stage. Nav2 needs a moment to report the goal as live, so
 *                       nothing may be concluded from its silence before this plus
 *                       the grace window
 */
public record DispatchAssignment(
        String orderId,
        int robotId,
        String destination,
        DispatchState state,
        long deadlineMillis,
        int attempts,
        long goalPublishedAtMillis
) {

    /**
     * Copy of this assignment moved on to its next stage, as a first attempt.
     *
     * @param publishedAtMillis when the goal for the new stage went out; 0 for
     *                          {@link DispatchState#AT_TABLE}, which publishes nothing
     */
    public DispatchAssignment movedTo(
            DispatchState newState,
            String newDestination,
            long newDeadlineMillis,
            long publishedAtMillis
    ) {
        return new DispatchAssignment(
                orderId,
                robotId,
                newDestination,
                newState,
                newDeadlineMillis,
                1,
                publishedAtMillis
        );
    }

    /** Copy of this assignment with the same stage goal published again. */
    public DispatchAssignment retried(long newDeadlineMillis, long publishedAtMillis) {
        return new DispatchAssignment(
                orderId,
                robotId,
                destination,
                state,
                newDeadlineMillis,
                attempts + 1,
                publishedAtMillis
        );
    }
}
