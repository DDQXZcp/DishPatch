# dispatch pipeline

## Files

| File | Role |
|---|---|
| `DispatchService` | The pipeline. Holds the state, runs the scheduled tick. |
| `DispatchAssignment` | One in-flight delivery. Immutable record, replaced on each transition. |
| `DispatchState` | `TO_TABLE` / `RETURNING`. |
| `DispatchController` | `GET /api/dispatch` — read-only diagnostic view. |

## Three state axes

Independent, and separately owned. Easy to conflate.

| Axis | Attached to | Owner | Values |
|---|---|---|---|
| Order status | an order | POS backend | `Preparing` / `Completed` / `Cancelled` (DynamoDB) |
| Robot status | a robot | **this package** | `Serving` / `Pickup` / `Returning` / `Waiting` / `Maintenance` |
| Dispatch state | a delivery job | **this package** | `TO_TABLE` / `RETURNING` (in memory) |

Robot status values are a contract with `RobotStatus` in
`control-frontend/src/types/Robot.ts` — anything outside that set renders unstyled.
Constants live on `RobotService`.

This package is the sole writer; `RobotService.updateField` deliberately leaves
status alone. `Pickup` and `Maintenance` have no producer yet.

## The pipeline

```
                  order pending
                       │
        [robot at counter, Waiting]
                       │  publish table goal, status → Serving
                       ▼
                   TO_TABLE ──── 5s ────┐
                                        │  mark order Completed
                                        │  publish counter goal, status → Returning
                                        ▼
                                   RETURNING ──── 5s ────┐
                                                         │  status → Waiting
                                                         │  assignment deleted
                                                         ▼
                                              [robot at counter, free]
```

A tick runs every 2 seconds:

1. **Advance** — every assignment past its deadline moves to its next stage.
2. **Assign** — pending orders, oldest first, get a robot while free ones last.

**Nothing blocks.** Spring's default scheduler is one thread, so a sleeping delivery
would stall every other one. Stages are deadlines checked each tick, never waits.

## Debug Endpoint

`GET /api/dispatch`

```json
{
  "enabled": true,
  "rosbridgeConnected": true,
  "millisSinceLastTick": 412,
  "queuedOrders": 3,
  "freeRobots": [1],
  "active": [
    { "orderId": "a3f1…", "robotId": 2, "destination": "T4",
      "state": "TO_TABLE", "millisRemaining": 3120, "robotStale": false }
  ],
  "skipped": [ { "orderId": "b7c2…", "reason": "Unknown destination: T99" } ]
}
```

### The counter invariant

> A robot is `Waiting` only when it is at the counter.

The meal is picked up at the counter, so a robot must be there before it can take an
order. `Waiting` means idle **and** at the counter.

**Not yet implemented.** `RobotService` marks a robot `Waiting` as soon as it reports
telemetry, wherever it is, and `freeRobotIds()` is just fresh-minus-busy. So a robot
mid-floor is assignable and gets driven straight to a table, carrying nothing.

Fix: home unrecognised robots to the counter first, assignable only once the homing
dwell expires. That makes the invariant structural instead of a rule to remember.

## State, and what is deliberately absent

The `Map<String, DispatchAssignment>` keyed by order id does three jobs:

1. the state machine's data — what is in flight and how far along
2. the **re-dispatch guard** — orders stay `Preparing` until delivery completes, so
   without this a new robot would be assigned every 2 seconds
3. the **robot-busy index** — free robots are fresh robots minus those in this map

So none of these exist, on purpose:

- **No queue.** DynamoDB holds `Preparing` orders; sorting by `orderDate` each tick
  gives FIFO. A queue would be a second source of truth.
- **No `WAITING` dispatch state.** An unassigned order is just not in the map.
- **No terminal state.** Deleting the record *is* the completion signal.
- **No persistence.** In memory, lost on restart — see special cases.
- **No repository.** The one durable write (`Preparing` → `Completed`) lives in
  `OrderService` already.

## Special cases

| Situation | Handling | Status |
|---|---|---|
| No free robot | Counted in `queuedOrders`, left `Preparing`, retried next tick. | Handled |
| rosbridge down | Not assigned; queued and retried. `publishGoal` returns normally when the link is down, so `isConnected()` is checked first. | Handled |
| Order has no table | `skipped` with a reason; not retried while it stays `Preparing`. | Handled |
| Table not on the map | Same. Distinct from queued — no robot makes it deliverable. | Handled |
| Skip list growth | Intersected with pending order ids each tick, so orders leaving `Preparing` drop off. | Handled |
| Same order on consecutive ticks | The assignment map is the guard. | Handled |
| Order deleted mid-delivery | `updateStatus` returns empty; logged, robot still returned and freed. | Handled |
| Counter goal fails to publish | Best effort — robot still moves to `RETURNING` so it is eventually freed. | Handled |
| Exception inside the tick | Caught. An escaping exception silently cancels all future runs of a `@Scheduled` method. | Handled |
| Concurrency | Scheduler writes, request threads read. `ConcurrentHashMap` and an immutable assignment replaced whole, so no torn reads. | Handled |
| Robot telemetry expires mid-delivery | Drops off the frontend map after 20s while the assignment still holds it. Reported as `robotStale`; delivery still completes on schedule. | Surfaced, not resolved |
| Cold start | Robots boot wherever the simulator puts them and are immediately assignable. Breaks the counter invariant. | **Not handled** |
| Backend restart mid-delivery | Assignments are lost; a robot parked at a table re-registers as `Waiting` and is reassigned at once. Same cause as cold start. | **Not handled** |
| Stale orders | A days-old `Preparing` order is still dispatched, and FIFO puts it **first**. A max-age guard belongs with the other skip checks, so it reports a reason. | **Not handled** |
| DynamoDB scan fails | Caught and logged; the tick carries on seeing zero orders. The endpoint then reads as an idle restaurant. A `lastError` field would close this. | **Not handled** |
