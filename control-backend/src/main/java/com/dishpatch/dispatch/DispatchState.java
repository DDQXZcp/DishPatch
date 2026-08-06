package com.dishpatch.dispatch;

/**
 * Stage of a single delivery job.
 * <p>
 * The driving stages end when the robot's reported position reaches the
 * destination. Only {@link #AT_TABLE} is on a timer, and that timer is serving
 * time rather than a stand-in for travel.
 */
public enum DispatchState {

    /** Table goal published; ends when the robot reaches the table. */
    TO_TABLE,

    /** At the table serving; ends when the serve dwell expires. */
    AT_TABLE,

    /** Order complete and counter goal published; ends when it reaches the counter. */
    RETURNING
}
