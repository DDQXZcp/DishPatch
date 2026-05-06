# robot_core

Owns the robot state machine and battery simulation. The single source of truth
for what state a robot is currently in.

**Node:** `core_node` (`robot_core/core_node.py`)

## Topics

| Topic | Direction | Message Type | Description |
|---|---|---|---|
| `/{ns}/status_update` | **publish** | `std_msgs/String` (JSON) | Emits state + battery on every transition and on battery ticks |
| `/{ns}/task_command` | **subscribe** | `std_msgs/String` (JSON) | Accepts commands from the Java backend to drive state transitions |

## Message Types

| Message | Source |
|---|---|
| `std_msgs/String` | ROS2 standard |

## Parameters

| Parameter | Default | Description |
|---|---|---|
| `robot_namespace` | `"robot"` | Namespace prefix used in topic names |
| `robot_id` | `"robot"` | Identifier included in status update payloads |
| `initial_battery` | `100.0` | Starting battery percentage |
| `auto_cycle` | `true` | Automatically advance states for simulation/demo purposes |

## State Machine

```
Waiting ──► Pickup ──► Serving ──► Returning ──► Waiting
                                                     │
                                             battery < 20 %
                                                     ▼
                                              Maintenance
                                                     │
                                             battery ≥ 95 %
                                                     ▼
                                                  Waiting
```

## Task Commands (`/{ns}/task_command` payload)

```json
{"command": "assign"}
```

| Command | Required current state | Transitions to |
|---|---|---|
| `assign` | `Waiting` | `Pickup` |
| `pickup` | `Pickup` | `Serving` |
| `complete` | `Serving` | `Returning` |
| `reset` | any | `Waiting` |

## Battery Simulation

| State | Rate |
|---|---|
| `Serving` / `Pickup` | −0.05 % per second |
| `Returning` | −0.02 % per second |
| `Waiting` / `Maintenance` | +0.10 % per second (charging) |

Battery is capped at 0–100 %. Dropping below 20 % forces a `Maintenance`
transition regardless of current state. Recovering to 95 % while in
`Maintenance` returns the robot to `Waiting` automatically.
