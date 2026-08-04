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
 */
public record DispatchAssignment(
        String orderId,
        int robotId,
        String destination,
        DispatchState state,
        long deadlineMillis
) {

    /** Copy of this assignment moved on to its next stage. */
    public DispatchAssignment movedTo(
            DispatchState newState,
            String newDestination,
            long newDeadlineMillis
    ) {
        return new DispatchAssignment(
                orderId,
                robotId,
                newDestination,
                newState,
                newDeadlineMillis
        );
    }
}
