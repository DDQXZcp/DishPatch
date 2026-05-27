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
    ros-jazzy-nav2-msgs \
    ros-jazzy-rmw-cyclonedds-cpp \
    && rm -rf /var/lib/apt/lists/*

# ── rosdep initialisation ──────────────────────────────────────────────────────
RUN if [ ! -f /etc/ros/rosdep/sources.list.d/20-default.list ]; then rosdep init; fi

# ── Copy workspace source (robot-only packages, no nav2_launcher) ─────────────
COPY src/shared_msgs ./src/shared_msgs
COPY src/robot_bringup ./src/robot_bringup
COPY src/robot_hardware ./src/robot_hardware
COPY src/robot_location_publisher ./src/robot_location_publisher
COPY src/robot_navigation ./src/robot_navigation
COPY src/robot_status ./src/robot_status
COPY config ./config
COPY scripts/robot_entrypoint.sh ./scripts/robot_entrypoint.sh
RUN chmod +x /ros2_ws/scripts/robot_entrypoint.sh

# ── Generate empty map (200x200 all free, 10m x 10m) ──────────────────────────
RUN python3 -c "open('/ros2_ws/config/map.pgm','wb').write(b'P5\n200 200\n255\n'+bytes([254]*200*200))"

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
CMD ["/ros2_ws/scripts/robot_entrypoint.sh"]
