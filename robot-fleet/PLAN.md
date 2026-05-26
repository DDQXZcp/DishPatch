# Plan: Pisah Nav2 ke Container Tersendiri

## Masalah

`Dockerfile.robot` install `ros-jazzy-nav2-bringup` (~1.2GB) di setiap robot image.
Padahal robot container hanya butuh:
- `nav_node.py` → fake odometry driver (butuh `nav_msgs`, `tf2_ros` saja)
- `goal_relay_node.py` → relay goal ke Nav2 (butuh `nav2_msgs` saja, bukan full bringup)

Nav2 stack yang berat (map_server, planner_server, controller_server, bt_navigator,
lifecycle_manager) bisa dijalankan sekali di container terpisah untuk semua robot.

## Arsitektur Baru

```
Sebelum:
  rosbridge  → WebSocket bridge
  robot1     → nav_node + goal_relay + hardware + status + NAV2 STACK (~3.5GB image)

Sesudah:
  rosbridge  → WebSocket bridge
  nav2       → Nav2 stack untuk semua robot (1 container, 1x install)
  robot1     → nav_node + goal_relay + hardware + status (~1.5GB image)
```

Semua container tetap di `ros_net` dengan `ROS_DOMAIN_ID=0` — Nav2 di container `nav2`
bisa berkomunikasi dengan robot di container `robot1` via ROS2 topics.

## File yang Perlu Diubah

### 1. `Dockerfile.robot` — Hapus nav2-bringup, ganti nav2-msgs

```dockerfile
# Sebelum
RUN apt-get update && apt-get install -y \
    python3-colcon-common-extensions \
    python3-rosdep \
    ros-jazzy-tf2-ros \
    ros-jazzy-nav-msgs \
    ros-jazzy-nav2-bringup \        ← hapus ini (~1.2GB)
    ros-jazzy-rmw-cyclonedds-cpp \
    && rm -rf /var/lib/apt/lists/*

# Sesudah
RUN apt-get update && apt-get install -y \
    python3-colcon-common-extensions \
    python3-rosdep \
    ros-jazzy-tf2-ros \
    ros-jazzy-nav-msgs \
    ros-jazzy-nav2-msgs \           ← ganti ini (~20MB, hanya message types)
    ros-jazzy-rmw-cyclonedds-cpp \
    && rm -rf /var/lib/apt/lists/*
```

### 2. `Dockerfile.nav2` — Baru, khusus Nav2

```dockerfile
FROM ros:jazzy-ros-base

ENV ROS_DISTRO=jazzy
ENV RMW_IMPLEMENTATION=rmw_cyclonedds_cpp

RUN apt-get update && apt-get install -y \
    ros-jazzy-nav2-bringup \
    ros-jazzy-rmw-cyclonedds-cpp \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /ros2_ws
COPY src/shared_msgs ./src/shared_msgs
COPY config ./config

RUN if [ ! -f /etc/ros/rosdep/sources.list.d/20-default.list ]; then rosdep init; fi && \
    rosdep update && \
    source /opt/ros/jazzy/setup.bash && \
    colcon build --packages-select shared_msgs

COPY scripts/nav2_entrypoint.sh ./scripts/nav2_entrypoint.sh
RUN chmod +x /ros2_ws/scripts/nav2_entrypoint.sh

CMD ["/ros2_ws/scripts/nav2_entrypoint.sh"]
```

### 3. `scripts/nav2_entrypoint.sh` — Baru

Launch Nav2 untuk setiap robot namespace yang aktif:

```bash
#!/bin/bash
set -e
source /opt/ros/jazzy/setup.bash
source /ros2_ws/install/setup.bash

NAMESPACES=${ROBOT_NAMESPACES:-robot1}

for NS in $(echo $NAMESPACES | tr ',' ' '); do
    sed "s/ROBOT_NS/${NS}/g" \
        /ros2_ws/config/nav2_params_template.yaml \
        > /tmp/nav2_params_${NS}.yaml

    ros2 launch nav2_bringup bringup_launch.py \
        namespace:=${NS} \
        params_file:=/tmp/nav2_params_${NS}.yaml \
        map:=/ros2_ws/config/map.yaml \
        use_sim_time:=false &
done

wait
```

### 4. `src/robot_bringup/launch/robot_launch.py` — Hapus Nav2 nodes

Hapus dari `generate_launch_description()`:
- `map_server`
- `planner_server`
- `controller_server`
- `bt_navigator`
- `lifecycle_manager`

Sisakan hanya:
- `hardware_node`
- `nav_node`
- `goal_relay_node`
- `status_node`
- `map_to_odom_tf`

### 5. `docker-compose.yml` — Tambah service nav2

```yaml
  nav2:
    build:
      context: .
      dockerfile: Dockerfile.nav2
    container_name: nav2
    restart: unless-stopped
    networks:
      - ros_net
    environment:
      - ROS_DOMAIN_ID=0
      - PYTHONUNBUFFERED=1
      - ROBOT_NAMESPACES=robot1
      - RMW_IMPLEMENTATION=rmw_cyclonedds_cpp
    depends_on:
      - rosbridge

  robot1:
    ...
    depends_on:
      - nav2    ← tunggu nav2 ready dulu
```

## Urutan Implementasi

1. Buat `Dockerfile.nav2`
2. Buat `scripts/nav2_entrypoint.sh`
3. Update `robot_launch.py` (hapus Nav2 nodes)
4. Update `Dockerfile.robot` (ganti nav2-bringup → nav2-msgs)
5. Update `docker-compose.yml` (tambah nav2 service, update depends_on)
6. Test lokal dengan `docker compose build && docker compose up`
7. Push → CI/CD deploy ke EC2

## Estimasi Penghematan Disk

| | Sebelum | Sesudah |
|---|---|---|
| robot image | ~3.5GB | ~1.5GB |
| nav2 image | — | ~2GB |
| **Total** | ~3.5GB | ~3.5GB |

Total disk sama, tapi robot image jauh lebih kecil.
Keuntungan utama: kalau ada 2-3 robot, nav2 tetap **1 container** — tidak multiply per robot.

| 1 robot | ~3.5GB | ~3.5GB |
| 2 robot | ~7GB   | ~5.5GB |
| 3 robot | ~10.5GB | ~7.5GB |
