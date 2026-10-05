# dispatch pipeline

## Files

| File | Role |
|---|---|
| `DispatchService` | The pipeline. Holds the state, runs the scheduled tick. |
| `DispatchAssignment` | One in-flight delivery. Immutable record, replaced on each transition. |
| `DispatchState` | `TO_TABLE` / `AT_TABLE` / `RETURNING`. |
| `DispatchController` | `GET /api/dispatch` — read-only diagnostic view. |

## Three state axes

Independent, and separately owned. Easy to conflate.

| Axis | Attached to | Owner | Values |
|---|---|---|---|
| Order status | an order | POS creates it; dispatch completes it; `OrderController` cancels it | `Preparing` / `Completed` / `Cancelled` (DynamoDB) |
| Robot status | a robot | **this package** | `Serving` / `Pickup` / `Returning` / `Waiting` / `Maintenance` |
| Dispatch state | a delivery job | **this package** | `TO_TABLE` / `AT_TABLE` / `RETURNING` (in memory) |

Robot status values are meant to match `RobotStatus` in
`control-frontend/src/types/Robot.ts`, and do not quite. `RobotService` defines five
constants; the frontend union has four — `Pickup` is missing, though
`RobotStats.pickupCount` survives. The fallback is not "unstyled": the map and the fleet
table both draw any status other than `Serving`, `Returning` or `Waiting` in the red they
use for `Maintenance`, so a `Pickup` robot looks like one under maintenance.

In the deployed pipeline this package is the only writer — `RobotService.updateField`
deliberately leaves status alone — and it never produces `Pickup` or `Maintenance`. The
exception is the `/app/robot-data` STOMP mapping, marked temporary, which copies whatever
status a client sends. Its one sender in the repo,
`control-backend/virtual-robots/virtual-robots.py`, cycles through all five.

`RobotService.setAssignment` writes status, `destination` and `orderId` together —
they always change as one — and the frontend picks the write up on the next
`RobotService.broadcastRobots()` tick. `yaw` comes
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
driving. They are not interchangeable, though: the terminal code is kept, because
"Nav2 stopped" and "Nav2 gave up" call for different responses. Collapsing them was
what let an aborted goal look exactly like a robot still on its way.

The distance check is a sanity check on top, not the primary signal — it separates
"stopped because it arrived" from "stopped because the goal was aborted". It is
deliberately looser than Nav2's `xy_goal_tolerance` of 0.25, since matching that
value would put both sides on the same knife edge.

Positions arrive on `/robot{id}/status` and are numerically in the map frame:
`nav_node` seeds its odometry from each robot's `INITIAL_X`/`INITIAL_Y`, which are
map coordinates. `RobotStatus` carries no `frame_id`, so that is a fleet convention
rather than a guarantee.

A driving stage that shows `navigating: false` on the endpoint means Nav2 has no
goal for that robot — lost or aborted. The dispatcher re-sends it once the grace
window has passed, and gives up on the delivery after `MAX_GOAL_ATTEMPTS`.

A tick runs every second:

1. **Advance** — assignments whose robot has arrived (or whose serve dwell expired)
   move on.
2. **Home** — robots not known to be at the counter are sent there.
3. **Assign** — pending orders, oldest first, get a robot while free ones last.

**Nothing blocks.** Progress is checked each tick, never waited on. Note the tick does
not run on a scheduler of its own: enabling the STOMP broker contributes a `TaskScheduler`
bean, and `@EnableScheduling` binds to it, so dispatch work shares the `MessageBroker-N`
pool that delivers dashboard updates. A blocking tick would stall the dashboard as well as
the other deliveries.

## Cancellation

An order is cancelled through the endpoint that changes any order's status —
`PUT /api/orders/{id}` with `"orderStatus": "Cancelled"`. There is no separate route.

The write is conditional on the order still being `Preparing`, so it is refused with a
409 once the order is `Completed` or already `Cancelled`. When it succeeds,
`OrderController` also calls `DispatchService.cancelOrder(id)`, which only records the id
in the `cancels` set. Nothing moves until the next tick, when `advanceAssignments()` checks
each assignment's order against that set before advancing it:

| Where the delivery is | What happens |
|---|---|
| No robot assigned yet | Nothing to undo. The order is no longer `Preparing`, so it is never dispatched. Its id stays in `cancels` for the life of the process — see special cases. |
| `TO_TABLE` or `AT_TABLE` | `abandon(…, "Order Cancelled")`: the assignment is deleted, and the robot is sent to the counter as `Returning` and homed like any robot the pipeline has not placed. |
| `RETURNING` | The meal has been handed over. The flag is consumed and ignored, and the robot finishes its run back. |

`abandon()` was written for the recovery path, and its warning ends "Order returns to the
queue" or "Order was already delivered". Neither is true of a cancellation: the order is
`Cancelled` in DynamoDB, so it is not dispatched again.

The DynamoDB write and the flag are not atomic. A tick that lands between them, just as that
order's serve dwell expires, finds a non-`Preparing` order at completion. That is handled like
any order that leaves `Preparing` mid-delivery (see special cases): the robot is sent back, and
the flag is consumed on the following tick.

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
      "navigating": true, "robotStale": false,
      "attempts": 1, "goalFailed": false }
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
| `homing` | Driving to the counter with no order. Re-sent if the goal dies on the way — a homing robot holds no order, so nothing else would notice it had stopped. |

A robot leaves `atCounter` when it takes an order and rejoins it on release. Losing
telemetry drops it from both, so it homes again on its return rather than being
trusted to still be where it was.

Consequence: after a restart every robot drives to the counter, and nothing
dispatches until the first one gets there.

## Load test

Log in first:

```bash
read -rp "POS email: <email>" POS_EMAIL && read -rsp "POS password: <password>" POS_PASS && echo

curl -s -c /tmp/dishpatch-cookies.txt -X POST https://posapi.dish-patch.com/api/user/login \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$POS_EMAIL\",\"password\":\"$POS_PASS\"}" \
  -w '\nlogin: %{http_code}\n' -o /dev/null
```

Send twenty orders to randomly chosen drop points:

```bash
for t in $(awk 'BEGIN{srand();n=split("T1 T2 T3 T4 T5 T6 T7 T8 T9 T10 T11 T12 T13 T14 T15 T16 T17 T18 R1 R2 R3 R4 R5 R6 R7",a," ");for(i=1;i<=20;i++)printf "%s ",a[int(rand()*n)+1]}'); do
  curl -s -b /tmp/dishpatch-cookies.txt -X POST https://posapi.dish-patch.com/api/order \
    -H 'Content-Type: application/json' \
    -d "{\"customerDetails\":{\"name\":\"Load test $t\",\"phone\":\"0400000000\",\"guests\":2},\"orderStatus\":\"Preparing\",\"bills\":{\"total\":0,\"tax\":0,\"totalWithTax\":0},\"items\":[],\"table\":\"$t\",\"paymentMethod\":\"Cash\"}" \
    -o /dev/null -w "$t %{http_code}\n"
  sleep 0.2
done
```

While it runs, watch `GET /api/dispatch`:

| Reading | Meaning |
|---|---|
| `freeRobots` returning to `[1,2]` between deliveries | healthy |
| `attempts` above 1 | a goal was lost and re-sent — the recovery path is working |
| a robot missing from `freeRobots` indefinitely | it is stranded; the thing this pipeline is meant to prevent |
| `queuedOrders` high while `freeRobots` is non-empty | a bug, not load |

These write real orders to the production table. Clear them out afterwards.

## State, and what is deliberately absent

The `Map<String, DispatchAssignment>` keyed by order id does three jobs:

1. the state machine's data — what is in flight and how far along
2. the **re-dispatch guard** — orders stay `Preparing` until delivery completes, so
   without this a new robot would be assigned every tick
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
| Order cancelled mid-delivery | Recorded by `cancelOrder`; the next tick abandons the assignment in `TO_TABLE` or `AT_TABLE` and sends the robot home. Ignored once `RETURNING`. See [Cancellation](#cancellation). | Handled |
| Order leaves `Preparing` by another route mid-delivery | A direct `PUT` with `Completed`, a POS write, an edit in the DynamoDB console. The completion write is conditional on `Preparing`, so it throws `OrderNotPreparingException`; that is caught and logged, and the robot is sent back regardless — the meal is already on the table. This used to escape: the robot stayed at the table, and because the tick catches at the top, every later tick skipped assignment too. One stale row stopped the fleet until a restart. | Handled |
| Counter goal fails to publish | Best effort — robot still moves to `RETURNING` so it is eventually freed. | Handled |
| Exception inside the tick | Caught. An escaping exception silently cancels all future runs of a `@Scheduled` method. But it is caught at the *top*, so a step that throws on every tick still skips everything after it — the row above is what that looks like. A step that can fail for one order must catch its own failure. | Handled |
| Cancel for an order no robot holds | The id is never consumed, so it stays in `cancels` for the life of the process. Small per entry, but unbounded: `skipped` has self-healing for exactly this, and `cancels` does not. | **Not handled** |
| Concurrency | Scheduler writes, request threads read. `ConcurrentHashMap` and an immutable assignment replaced whole, so no torn reads. | Handled |
| Cold start | Robots boot wherever the simulator puts them, so each is homed to the counter before it can take an order. | Handled |
| Backend restart mid-delivery | Assignments are lost, so the robot is treated as unplaced and homed. Its order stays `Preparing` and is dispatched again. | Handled |
| Telemetry lapses at the counter | Dropped from `atCounter`/`homing`, so the robot homes again when it comes back rather than being trusted to still be there. | Handled |
| Robot telemetry expires mid-delivery | Drops off the frontend map after 20s while the assignment still holds it. Reported as `robotStale`. Stages advance on position, so the delivery stops progressing until it reports again. | Surfaced, not resolved |
| Goal never reaches Nav2 | A publish is dropped if the ROS publisher has not yet discovered Nav2's `bt_navigator`, which subscribes to `/{ns}/goal_pose` itself. Goal topics are advertised at connection time, so discovery finishes long before the first goal is sent. | Handled |
| Nav2 aborts a goal, or one goes missing anyway | The robot goes idle short of its destination. `navigating: false` with a large `metresToGo` is the signature. Once a grace window has passed, the goal is re-sent; after `MAX_GOAL_ATTEMPTS` the delivery is given up on, the order goes back in the queue, and the robot is sent home and released. Every step logs a warning. | **Handled** |
| Stale orders | A days-old `Preparing` order is still dispatched, and FIFO puts it **first**. A max-age guard belongs with the other skip checks, so it reports a reason. | **Not handled** |
| DynamoDB scan fails | Caught and logged; the tick carries on seeing zero orders. The endpoint then reads as an idle restaurant. A `lastError` field would close this. | **Not handled** |
