package com.dishpatch.dispatch;

/**
 * Stage of a single delivery job.
 * <p>
 * There is no arrival feedback from Nav2, so "driving to the table" and "sitting
 * at the table" cannot be told apart — the configured dwell stands in for the
 * whole trip. If arrival feedback is ever wired up, {@link #TO_TABLE} splits into
 * a driving stage and a dwelling stage.
 */
public enum DispatchState {

    /** Table goal published; the dwell expiring means "assume it arrived". */
    TO_TABLE,

    /** Order marked complete and counter goal published; robot is on its way back. */
    RETURNING
}
