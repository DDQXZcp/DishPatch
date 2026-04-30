# shared_msgs

Custom ROS2 message definitions shared across all robot packages.

**Build type:** CMake (`ament_cmake`)
**Must be built before** any Python package that imports these messages.

## Messages

### `RobotStatus.msg`

Published on `/{ns}/status` by `robot_status`. Consumed by rosbridge and forwarded to the Java backend.

```
string robot_id        # Unique robot identifier, e.g. "robot1"
string state           # One of: Waiting | Pickup | Serving | Returning | Maintenance
float32 battery        # Battery percentage 0.0 – 100.0
geometry_msgs/Pose pose  # Current position and orientation in the map frame
```

**Depends on:** `geometry_msgs/Pose`

---

### `TaskStatus.msg`

Intended for task tracking and future task-management features.

```
string task_id
string robot_id
string task_type
string status
string target_location
builtin_interfaces/Time created_at
builtin_interfaces/Time updated_at
```

**Depends on:** `builtin_interfaces/Time`
