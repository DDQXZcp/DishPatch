# ── Robot container ────────────────────────────────────────────────────────────
# Builds the full ROS2 workspace containing all robot packages.
# The namespace is supplied at runtime via the ROBOT_NAMESPACE env var
# (set in docker-compose.yml or on the docker run command line).
# Changes to get new commit comment.

# ──────────────────────────────────────────────────────────────────────────────
FROM ros:jazzy-ros-base

SHELL ["/bin/bash", "-c"]

ENV ROS_DISTRO=jazzy
ENV PYTHONUNBUFFERED=1
ENV RMW_IMPLEMENTATION=rmw_cyclonedds_cpp

WORKDIR /ros2_ws

# ── System dependencies ────────────────────────────────────────────────────────
RUN apt-get update && apt-get install -y \
    python3-colcon-common-extensions \
    python3-rosdep \
    ros-jazzy-tf2-ros \
    ros-jazzy-nav-msgs \
    ros-jazzy-nav2-bringup \
    ros-jazzy-rmw-cyclonedds-cpp \
    && rm -rf /var/lib/apt/lists/*

# ── rosdep initialisation ──────────────────────────────────────────────────────
RUN if [ ! -f /etc/ros/rosdep/sources.list.d/20-default.list ]; then rosdep init; fi

# ── Copy workspace source ──────────────────────────────────────────────────────
COPY src ./src

# ── Install ROS dependencies declared in package.xml files ────────────────────
RUN rosdep update && \
    rosdep install --from-paths src --ignore-src -r -y

# ── Build workspace ────────────────────────────────────────────────────────────
# shared_msgs (CMake) must be built first so the Python packages that depend
# on its generated interfaces can find them at build time.
RUN source /opt/ros/jazzy/setup.bash && \
    colcon build \
      --symlink-install \
      --packages-select shared_msgs && \
    source /ros2_ws/install/setup.bash && \
    colcon build \
      --symlink-install \
      --packages-skip shared_msgs

# ── Entrypoint ─────────────────────────────────────────────────────────────────
# ROBOT_NAMESPACE must be set (e.g. robot1, robot2).
# AUTO_CYCLE=true  → robot simulates realistic state transitions automatically.
CMD ["bash", "-c", "source /opt/ros/jazzy/setup.bash && source /ros2_ws/install/setup.bash && exec ros2 launch robot_bringup robot_launch.py namespace:=${ROBOT_NAMESPACE:-robot} robot_id:=${ROBOT_NAMESPACE:-robot} initial_battery:=${INITIAL_BATTERY:-100.0}"]
