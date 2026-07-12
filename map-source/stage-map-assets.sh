#!/bin/bash
set -euo pipefail

MODE=${1:-stage}

if [ "${MODE}" != "stage" ] && [ "${MODE}" != "--check" ]; then
    echo "Usage: $0 [stage|--check]" >&2
    exit 1
fi

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_ROOT=$(cd "${SCRIPT_DIR}/.." && pwd)

SOURCE_DIR="${SCRIPT_DIR}"
SOURCE_MAP_YAML="${SOURCE_DIR}/the-hive-landscape-mask-nav2.yaml"
SOURCE_DROP_POINTS_YAML="${SOURCE_DIR}/the-hive-drop-points.yaml"

ROBOT_FLEET_CONFIG_DIR="${REPO_ROOT}/robot-fleet/config"
CONTROL_FRONTEND_MAP_DIR="${REPO_ROOT}/control-frontend/public/maps"
CONTROL_BACKEND_CONFIG_DIR="${REPO_ROOT}/control-backend/config"

ROBOT_FLEET_MAP_YAML="${ROBOT_FLEET_CONFIG_DIR}/map.yaml"
ROBOT_FLEET_MAP_IMAGE="${ROBOT_FLEET_CONFIG_DIR}/map.png"
CONTROL_FRONTEND_FLOORPLAN="${CONTROL_FRONTEND_MAP_DIR}/map-floorplan.webp"
CONTROL_FRONTEND_MANIFEST="${CONTROL_FRONTEND_MAP_DIR}/map-manifest.json"
CONTROL_BACKEND_DROP_POINTS="${CONTROL_BACKEND_CONFIG_DIR}/drop-points.json"

require_file() {
    local path=$1
    local label=$2

    if [ ! -f "${path}" ]; then
        echo "Missing ${label}: ${path}" >&2
        exit 1
    fi
}

read_yaml_value() {
    local key=$1
    local file=$2

    awk -F: -v key="${key}" '$1 ~ "^[[:space:]]*" key "[[:space:]]*$" { print $2; exit }' "${file}" \
        | sed 's/^[[:space:]]*//' \
        | tr -d '"'
}

resolve_source_path() {
    local raw_path=$1

    case "${raw_path}" in
        /*) printf '%s\n' "${raw_path}" ;;
        *) printf '%s\n' "${SOURCE_DIR}/${raw_path}" ;;
    esac
}

compare_file() {
    local expected=$1
    local actual=$2
    local label=$3
    local diffable=${4:-text}

    if ! cmp -s "${expected}" "${actual}"; then
        echo "${label} is out of sync" >&2
        if [ "${diffable}" = "text" ] && [ -f "${actual}" ]; then
            diff -u "${expected}" "${actual}" >&2 || true
        fi
        exit 1
    fi
}

require_file "${SOURCE_MAP_YAML}" "source Nav2 map metadata"
require_file "${SOURCE_DROP_POINTS_YAML}" "source drop-point metadata"

SOURCE_MAP_IMAGE_NAME=$(read_yaml_value "image" "${SOURCE_MAP_YAML}")
SOURCE_FLOORPLAN_NAME=$(read_yaml_value "source_image" "${SOURCE_DROP_POINTS_YAML}")

if [ -z "${SOURCE_MAP_IMAGE_NAME}" ]; then
    echo "Missing image field in ${SOURCE_MAP_YAML}" >&2
    exit 1
fi

if [ -z "${SOURCE_FLOORPLAN_NAME}" ]; then
    echo "Missing source_image field in ${SOURCE_DROP_POINTS_YAML}" >&2
    exit 1
fi

SOURCE_MAP_IMAGE=$(resolve_source_path "${SOURCE_MAP_IMAGE_NAME}")
SOURCE_FLOORPLAN_IMAGE=$(resolve_source_path "${SOURCE_FLOORPLAN_NAME}")

require_file "${SOURCE_MAP_IMAGE}" "source Nav2 map image"
require_file "${SOURCE_FLOORPLAN_IMAGE}" "source frontend floorplan image"

TMP_DIR=$(mktemp -d)
trap 'rm -rf "${TMP_DIR}"' EXIT

NORMALIZED_MAP_YAML="${TMP_DIR}/map.yaml"
FRONTEND_MANIFEST_TMP="${TMP_DIR}/map-manifest.json"
BACKEND_DROP_POINTS_TMP="${TMP_DIR}/drop-points.json"

sed 's|^[[:space:]]*image[[:space:]]*:.*|image: map.png|' "${SOURCE_MAP_YAML}" > "${NORMALIZED_MAP_YAML}"

python3 - "${SOURCE_DROP_POINTS_YAML}" "${FRONTEND_MANIFEST_TMP}" "${BACKEND_DROP_POINTS_TMP}" <<'PY'
import json
import re
import sys

source_path, frontend_manifest_path, backend_drop_points_path = sys.argv[1:4]

with open(source_path, "r", encoding="utf-8") as source_file:
    text = source_file.read()


def strip_value(value):
    return value.strip().strip('"').strip("'")


def scalar(name, default=None):
    match = re.search(rf"^{re.escape(name)}:\s*(.+)$", text, re.MULTILINE)
    if match:
        return strip_value(match.group(1))
    return default


def number_array(name):
    match = re.search(rf"^{re.escape(name)}:\s*\[([^\]]+)\]", text, re.MULTILINE)
    if not match:
        raise SystemExit(f"Missing {name} in {source_path}")
    return [float(part.strip()) for part in match.group(1).split(",")]


def parse_pose(pose_text):
    values = {}
    for part in pose_text.split(","):
        key, value = part.split(":", 1)
        values[key.strip()] = float(value.strip())
    return values


image_size = number_array("image_size_px")
origin = number_array("origin")
resolution = float(scalar("resolution"))
frame_id = scalar("frame_id", "map")
map_name = scalar("map")

drop_points = []
current_id = None

for line in text.splitlines():
    id_match = re.match(r"\s*-\s+id:\s*(.+)$", line)
    if id_match:
        current_id = strip_value(id_match.group(1))
        continue

    pose_match = re.match(r"\s*pose:\s*\{(.+)\}\s*$", line)
    if pose_match and current_id:
        pose = parse_pose(pose_match.group(1))
        drop_points.append({
            "id": current_id,
            "x": pose["x"],
            "y": pose["y"],
            "yaw": pose.get("yaw", 0.0),
        })
        current_id = None

if not drop_points:
    raise SystemExit(f"No drop points found in {source_path}")

frontend_manifest = {
    "imageUrl": "/maps/map-floorplan.webp",
    "imageSizePx": [int(image_size[0]), int(image_size[1])],
    "resolution": resolution,
    "origin": origin,
    "coordinateFrame": "ros-map-meters",
}

backend_drop_points = {
    "map": map_name,
    "frameId": frame_id,
    "resolution": resolution,
    "origin": origin,
    "dropPoints": drop_points,
}

with open(frontend_manifest_path, "w", encoding="utf-8") as manifest_file:
    json.dump(frontend_manifest, manifest_file, indent=2)
    manifest_file.write("\n")

with open(backend_drop_points_path, "w", encoding="utf-8") as drop_points_file:
    json.dump(backend_drop_points, drop_points_file, indent=2)
    drop_points_file.write("\n")
PY

if [ "${MODE}" = "--check" ]; then
    compare_file "${NORMALIZED_MAP_YAML}" "${ROBOT_FLEET_MAP_YAML}" "Robot fleet map metadata"
    compare_file "${SOURCE_MAP_IMAGE}" "${ROBOT_FLEET_MAP_IMAGE}" "Robot fleet map image" binary
    compare_file "${SOURCE_FLOORPLAN_IMAGE}" "${CONTROL_FRONTEND_FLOORPLAN}" "Control frontend floorplan" binary
    compare_file "${FRONTEND_MANIFEST_TMP}" "${CONTROL_FRONTEND_MANIFEST}" "Control frontend map manifest"
    compare_file "${BACKEND_DROP_POINTS_TMP}" "${CONTROL_BACKEND_DROP_POINTS}" "Control backend drop points"
    echo "Map assets are staged up to date"
    exit 0
fi

mkdir -p "${ROBOT_FLEET_CONFIG_DIR}" "${CONTROL_FRONTEND_MAP_DIR}" "${CONTROL_BACKEND_CONFIG_DIR}"
rm -f "${ROBOT_FLEET_CONFIG_DIR}/the-hive-landscape-mask-nav2.png"

cp "${NORMALIZED_MAP_YAML}" "${ROBOT_FLEET_MAP_YAML}"
cp "${SOURCE_MAP_IMAGE}" "${ROBOT_FLEET_MAP_IMAGE}"
cp "${SOURCE_FLOORPLAN_IMAGE}" "${CONTROL_FRONTEND_FLOORPLAN}"
cp "${FRONTEND_MANIFEST_TMP}" "${CONTROL_FRONTEND_MANIFEST}"
cp "${BACKEND_DROP_POINTS_TMP}" "${CONTROL_BACKEND_DROP_POINTS}"

echo "Staged map assets from ${SOURCE_DIR}"
