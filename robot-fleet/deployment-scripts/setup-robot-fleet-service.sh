#!/bin/bash
set -euo pipefail

SERVICE_NAME=dishpatch-robot-fleet
REMOTE_DIR=${REMOTE_DIR:-/home/ubuntu/robot-fleet}
SERVICE_USER=${SERVICE_USER:-ubuntu}
SERVICE_FILE=/etc/systemd/system/${SERVICE_NAME}.service
COMPOSE_FILE=${REMOTE_DIR}/docker-compose.yml

install_package() {
  local package_name=$1

  if command -v dnf >/dev/null 2>&1; then
    sudo dnf install -y "${package_name}"
  elif command -v yum >/dev/null 2>&1; then
    sudo yum install -y "${package_name}"
  elif command -v apt-get >/dev/null 2>&1; then
    sudo apt-get update
    sudo apt-get install -y "${package_name}"
  else
    echo "No supported package manager found to install ${package_name}."
    exit 1
  fi
}

install_docker() {
  if command -v docker >/dev/null 2>&1; then
    return
  fi

  if command -v amazon-linux-extras >/dev/null 2>&1; then
    sudo amazon-linux-extras install -y docker
  elif command -v apt-get >/dev/null 2>&1; then
    install_package docker.io
  else
    install_package docker
  fi
}

install_compose_plugin() {
  if docker compose version >/dev/null 2>&1; then
    return
  fi

  if command -v dnf >/dev/null 2>&1; then
    sudo dnf install -y docker-compose-plugin || true
  elif command -v yum >/dev/null 2>&1; then
    sudo yum install -y docker-compose-plugin || true
  elif command -v apt-get >/dev/null 2>&1; then
    sudo apt-get update
    sudo apt-get install -y docker-compose-plugin || true
  fi

  if docker compose version >/dev/null 2>&1; then
    return
  fi

  if ! command -v curl >/dev/null 2>&1; then
    install_package curl
  fi

  local arch
  case "$(uname -m)" in
    x86_64)
      arch=x86_64
      ;;
    aarch64|arm64)
      arch=aarch64
      ;;
    *)
      echo "Unsupported architecture for Docker Compose plugin: $(uname -m)"
      exit 1
      ;;
  esac

  local compose_url
  if [ -n "${DOCKER_COMPOSE_VERSION:-}" ]; then
    compose_url="https://github.com/docker/compose/releases/download/${DOCKER_COMPOSE_VERSION}/docker-compose-linux-${arch}"
  else
    compose_url="https://github.com/docker/compose/releases/latest/download/docker-compose-linux-${arch}"
  fi

  local tmp_file
  tmp_file=$(mktemp)
  curl -fsSL "${compose_url}" -o "${tmp_file}"
  sudo mkdir -p /usr/local/lib/docker/cli-plugins
  sudo install -m 0755 "${tmp_file}" /usr/local/lib/docker/cli-plugins/docker-compose
  rm -f "${tmp_file}"

  docker compose version >/dev/null
}

if [ ! -f "${COMPOSE_FILE}" ]; then
  echo "Missing Docker Compose file: ${COMPOSE_FILE}"
  exit 1
fi

install_docker
sudo systemctl enable --now docker.service
install_compose_plugin

DOCKER_BIN=$(command -v docker)

sudo chown -R "${SERVICE_USER}:${SERVICE_USER}" "${REMOTE_DIR}"
sudo "${DOCKER_BIN}" compose -f "${COMPOSE_FILE}" config >/dev/null
sudo "${DOCKER_BIN}" compose -f "${COMPOSE_FILE}" build

sudo tee "${SERVICE_FILE}" >/dev/null <<EOF
[Unit]
Description=DishPatch Robot Fleet Docker Compose Service
Requires=docker.service
After=network-online.target docker.service
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=${REMOTE_DIR}
ExecStartPre=-${DOCKER_BIN} compose -f ${COMPOSE_FILE} down --remove-orphans
ExecStart=${DOCKER_BIN} compose -f ${COMPOSE_FILE} up --remove-orphans
ExecStop=${DOCKER_BIN} compose -f ${COMPOSE_FILE} down
Restart=on-failure
RestartSec=10
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable "${SERVICE_NAME}.service"
sudo systemctl restart "${SERVICE_NAME}.service"
sudo systemctl --no-pager status "${SERVICE_NAME}.service"
