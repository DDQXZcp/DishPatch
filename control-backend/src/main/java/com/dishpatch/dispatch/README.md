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
| Dispatch state | a delivery job | **this package** | `TO_TABLE` / `AT_TABLE` / `RETURNING` (in memory) |

Robot status values are a contract with `RobotStatus` in
`control-frontend/src/types/Robot.ts` — anything outside that set renders unstyled.
Constants live on `RobotService`.

This package is the sole writer; `RobotService.updateField` deliberately leaves
status alone. `Pickup` and `Maintenance` have no producer yet.

`RobotService.setAssignment` writes status, `destination` and `orderId` together —
they always change as one — and each write broadcasts to the frontend. `yaw` comes
from telemetry, not from here.

## The pipeline

```
                  order pending
                       │
        [robot at counter, Waiting]
                       │  publish table goal, status → Serving
                       ▼
                   TO_TABLE ──── Nav2 done, at the table ────┐
                                                              ▼
                                                          AT_TABLE ──── 5s ────┐
                                                     │  mark order Completed   │
                                                     │  counter goal, Returning│
                                        ┌────────────────────────────────◀─────┘
                                        ▼
                                   RETURNING ──── Nav2 done, at the counter ─────┐
                                                         │  status → Waiting     │
                                                         │  assignment deleted   │
                                              [robot at counter, free] ◀─────────┘
```

Stage changes come from **Nav2**, not a timer. A driving stage ends when Nav2 no
longer holds a live goal for that robot *and* its position is within
`ARRIVAL_RADIUS_M` (0.6m) of the destination. Only `AT_TABLE` is on a clock, and
that 5s is serving time, not a stand-in for travel.

Nav2's verdict comes from `/robot{id}/navigate_to_pose/_action/status`
(`action_msgs/GoalStatusArray`). It's a hidden topic so `rosapi` won't list it, but
it subscribes by name and is latched. A goal counts as live while it is `ACCEPTED`
or `EXECUTING`; `SUCCEEDED`, `ABORTED` and `CANCELED` all mean Nav2 has stopped
driving.

The distance check is a sanity check on top, not the primary signal — it separates
"stopped because it arrived" from "stopped because the goal was aborted". It is
deliberately looser than Nav2's `xy_goal_tolerance` of 0.25, since matching that
value would put both sides on the same knife edge.

Positions arrive on `/robot{id}/status` and are numerically in the map frame:
`nav_node` seeds its odometry from each robot's `INITIAL_X`/`INITIAL_Y`, which are
map coordinates. `RobotStatus` carries no `frame_id`, so that is a fleet convention
rather than a guarantee.

A driving stage that shows `navigating: false` on the endpoint means Nav2 has no
goal for that robot — lost or aborted. Nothing re-sends it automatically; the robot
will sit still until the backend restarts.

A tick runs every 2 seconds:

1. **Advance** — assignments whose robot has arrived (or whose serve dwell expired)
   move on.
2. **Home** — robots not known to be at the counter are sent there.
3. **Assign** — pending orders, oldest first, get a robot while free ones last.

**Nothing blocks.** Spring's default scheduler is one thread, so a sleeping delivery
would stall every other one. Progress is checked each tick, never waited on.

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
    { "orderId": "a3f1…", "robotId": 2, "destination": "T4", "state": "TO_TABLE",
      "millisRemaining": 0, "metresToGo": 12.4,
      "navigating": true, "robotStale": false }
  ],
  "skipped": [ { "orderId": "b7c2…", "reason": "Unknown destination: T99" } ]
}
```

### The counter invariant

> A robot is `Waiting` only when it is at the counter.

The meal is picked up at the counter, so a robot must be there before it can take an
order. `Waiting` means idle **and** at the counter.

Robots are not born at the counter — one that has just booted, or that reappears
after a restart, is standing wherever it stopped. So any robot the pipeline has not
placed itself is **homed** first: sent to the counter, status `Returning`, and added
to the free set only when its position says it got there. A robot already parked at
the counter is adopted without being commanded anywhere.

Two collections make this structural rather than a rule to remember:

| | Meaning |
|---|---|
| `atCounter` | Parked at the counter and idle. This is what `freeRobotIds()` returns. |
| `homing` | Driving to the counter with no order, mapped to an arrival deadline. |

A robot leaves `atCounter` when it takes an order and rejoins it on release. Losing
telemetry drops it from both, so it homes again on its return rather than being
trusted to still be where it was.

Consequence: after a restart every robot drives to the counter, and nothing
dispatches until the first one gets there.

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
| Cold start | Robots boot wherever the simulator puts them, so each is homed to the counter before it can take an order. | Handled |
| Backend restart mid-delivery | Assignments are lost, so the robot is treated as unplaced and homed. Its order stays `Preparing` and is dispatched again. | Handled |
| Telemetry lapses at the counter | Dropped from `atCounter`/`homing`, so the robot homes again when it comes back rather than being trusted to still be there. | Handled |
| Robot telemetry expires mid-delivery | Drops off the frontend map after 20s while the assignment still holds it. Reported as `robotStale`. Stages advance on position, so the delivery stops progressing until it reports again. | Surfaced, not resolved |
| Goal never reaches Nav2 | A publish is dropped if the ROS publisher has not yet discovered `goal_relay_node`. Goal topics are advertised at connection time, so discovery finishes long before the first goal is sent. | Handled |
| Nav2 aborts a goal, or one goes missing anyway | The robot goes idle short of its destination and nothing moves it again — the stage never ends, the order never completes, the robot is never freed. `navigating: false` with a large `metresToGo` is the signature. Never observed in this fleet: 48 goals, 0 aborts. Re-sending the goal while Nav2 is idle would fix it. | **Not handled** |
| Stale orders | A days-old `Preparing` order is still dispatched, and FIFO puts it **first**. A max-age guard belongs with the other skip checks, so it reports a reason. | **Not handled** |
| DynamoDB scan fails | Caught and logged; the tick carries on seeing zero orders. The endpoint then reads as an idle restaurant. A `lastError` field would close this. | **Not handled** |
