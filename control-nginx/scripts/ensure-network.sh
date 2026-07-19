#!/usr/bin/env bash

set -Eeuo pipefail

NETWORK_NAME="${DISH_PATCH_NETWORK_NAME:-dishpatch-network}"

if ! command -v docker >/dev/null 2>&1; then
  echo "Error: Docker is not installed or is unavailable."
  exit 1
fi

if docker network inspect "${NETWORK_NAME}" >/dev/null 2>&1; then
  echo "Docker network '${NETWORK_NAME}' already exists."
  exit 0
fi

echo "Creating Docker network '${NETWORK_NAME}'..."

docker network create \
  --driver bridge \
  --label com.dishpatch.managed-by=github-actions \
  "${NETWORK_NAME}"

echo "Docker network '${NETWORK_NAME}' created successfully."