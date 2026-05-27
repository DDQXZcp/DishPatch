#!/bin/bash
set -euo pipefail

MODE=${1:-stage}

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
ROBOT_FLEET_DIR=$(cd "${SCRIPT_DIR}/.." && pwd)
REPO_ROOT=$(cd "${ROBOT_FLEET_DIR}/.." && pwd)

SOURCE_DIR="${REPO_ROOT}/map-source"
TARGET_DIR="${ROBOT_FLEET_DIR}/config"

SOURCE_MAP_YAML="${SOURCE_DIR}/the-hive-landscape-mask-nav2.yaml"
TARGET_MAP_YAML="${TARGET_DIR}/map.yaml"
TARGET_MAP_IMAGE="${TARGET_DIR}/map.png"

if [ ! -f "${SOURCE_MAP_YAML}" ]; then
    echo "Missing source map metadata: ${SOURCE_MAP_YAML}" >&2
    exit 1
fi

SOURCE_MAP_IMAGE_NAME=$(awk -F: '/^[[:space:]]*image[[:space:]]*:/ { print $2; exit }' "${SOURCE_MAP_YAML}" | tr -d ' "')

if [ -z "${SOURCE_MAP_IMAGE_NAME}" ]; then
    echo "Missing image field in source map metadata: ${SOURCE_MAP_YAML}" >&2
    exit 1
fi

case "${SOURCE_MAP_IMAGE_NAME}" in
    /*) SOURCE_MAP_IMAGE="${SOURCE_MAP_IMAGE_NAME}" ;;
    *) SOURCE_MAP_IMAGE="${SOURCE_DIR}/${SOURCE_MAP_IMAGE_NAME}" ;;
esac

if [ ! -f "${SOURCE_MAP_IMAGE}" ]; then
    echo "Missing source map image: ${SOURCE_MAP_IMAGE}" >&2
    exit 1
fi

NORMALIZED_MAP_YAML=$(mktemp)
trap 'rm -f "${NORMALIZED_MAP_YAML}"' EXIT
sed 's|^[[:space:]]*image[[:space:]]*:.*|image: map.png|' "${SOURCE_MAP_YAML}" > "${NORMALIZED_MAP_YAML}"

if [ "${MODE}" = "--check" ]; then
    if ! cmp -s "${NORMALIZED_MAP_YAML}" "${TARGET_MAP_YAML}"; then
        echo "Staged map metadata is out of sync with ${SOURCE_MAP_YAML}" >&2
        diff -u "${NORMALIZED_MAP_YAML}" "${TARGET_MAP_YAML}" >&2 || true
        exit 1
    fi

    if ! cmp -s "${SOURCE_MAP_IMAGE}" "${TARGET_MAP_IMAGE}"; then
        echo "Staged map image is out of sync with ${SOURCE_MAP_IMAGE}" >&2
        exit 1
    fi

    echo "Nav2 map staging is up to date"
    exit 0
fi

if [ "${MODE}" != "stage" ]; then
    echo "Usage: $0 [stage|--check]" >&2
    exit 1
fi

mkdir -p "${TARGET_DIR}"
rm -f "${TARGET_DIR}/the-hive-landscape-mask-nav2.png"
cp "${NORMALIZED_MAP_YAML}" "${TARGET_MAP_YAML}"
cp "${SOURCE_MAP_IMAGE}" "${TARGET_MAP_IMAGE}"

echo "Staged Nav2 map files into ${TARGET_DIR}"
