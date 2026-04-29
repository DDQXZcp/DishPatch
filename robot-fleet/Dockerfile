FROM ros:jazzy-ros-base

SHELL ["/bin/bash", "-c"]

ENV ROS_DISTRO=jazzy
ENV PYTHONUNBUFFERED=1

WORKDIR /ros2_ws

RUN apt-get update && apt-get install -y \
    python3-colcon-common-extensions \
    python3-rosdep \
    && rm -rf /var/lib/apt/lists/*

RUN if [ ! -f /etc/ros/rosdep/sources.list.d/20-default.list ]; then rosdep init; fi

COPY src ./src

RUN rosdep update && \
    rosdep install --from-paths src --ignore-src -r -y

RUN source /opt/ros/jazzy/setup.bash && \
    colcon build --symlink-install

CMD ["bash", "-c", "source /opt/ros/jazzy/setup.bash && source /ros2_ws/install/setup.bash && ros2 run robot_location_publisher location_publisher"]
