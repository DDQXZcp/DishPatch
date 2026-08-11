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
 * @param deadlineMillis wall clock at which the serve dwell ends; 0 on the driving
 *                       stages, which advance on the robot's reported position
 * @param lastGoalMillis wall clock at which a goal was last published for the
 *                       current stage; the re-send waits on this so it does not fire
 *                       inside the window where Nav2 has not reported the goal yet
 * @param goalAttempts   goals published for the current stage. 1 in the normal case,
 *                       0 for a stage entered without one going out at all. Climbs
 *                       only when goals are being lost, so it doubles as the signal
 *                       that a delivery is in trouble
 */
public record DispatchAssignment(
        String orderId,
        int robotId,
        String destination,
        DispatchState state,
        long deadlineMillis,
        long lastGoalMillis,
        int goalAttempts
) {

    /**
     * Copy of this assignment moved on to its next stage.
     * <p>
     * The goal history restarts, since a driving stage begins with its own freshly
     * published goal. {@code AT_TABLE} publishes nothing and never consults it.
     *
     * @param goalMillis when the goal for the new stage went out, or 0 if none did —
     *                   a stage entered without a goal has made no attempts yet, and
     *                   the re-send treats it as overdue immediately rather than
     *                   waiting out a grace period against a goal that never existed
     */
    public DispatchAssignment movedTo(
            DispatchState newState,
            String newDestination,
            long newDeadlineMillis,
            long goalMillis
    ) {
        return new DispatchAssignment(
                orderId,
                robotId,
                newDestination,
                newState,
                newDeadlineMillis,
                goalMillis,
                goalMillis == 0 ? 0 : 1
        );
    }

    /**
     * Copy of this assignment with another goal published for the same stage.
     * <p>
     * Stage, destination and deadline are untouched — only the goal was re-sent.
     *
     * @param nowMillis when the re-sent goal went out
     */
    public DispatchAssignment withGoalResent(long nowMillis) {
        return new DispatchAssignment(
                orderId,
                robotId,
                destination,
                state,
                deadlineMillis,
                nowMillis,
                goalAttempts + 1
        );
    }
}
