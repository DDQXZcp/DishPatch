import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useRobotContext } from '../../context/RobotWebSocketProvider';
import { DASHBOARD_RESET_VIEW_EVENT } from '../dashboard/dashboardLayout';
import { buildOrderTableIndex, formatOrderItemLine, type OrderTableInfo } from '../../utils/orderTable';
import type { Robot, RobotStatus } from '../../types/Robot';


const MAP_MANIFEST_URL = "/maps/map-manifest.json";
type FloorplanBounds = [[number, number], [number, number]];

interface MapManifest {
  imageUrl: string;
  imageSizePx: [number, number];
  resolution: number;
  origin: [number, number, number];
  coordinateFrame: string;
}

interface LoadedMap {
  manifest: MapManifest;
  bounds: FloorplanBounds;
}

interface RobotMarkerState {
  marker: L.Marker;
  animationFrameId: number | null;
}

const ROBOT_MARKER_ANIMATION_DURATION_MS = 280;
const ROBOT_MARKER_SNAP_DISTANCE = 0.01;
const MAP_MIN_ZOOM = -3;
const MAP_MAX_ZOOM = 2;

// Fix for default Leaflet markers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

function getRobotIcon(status: RobotStatus) {
  let borderColor = '';

  if (status === 'Serving') borderColor = 'border-green-500';
  else if (status === 'Returning') borderColor = 'border-blue-500';
  else if (status === 'Waiting') borderColor = 'border-purple-500';
  else if (status === 'Maintenance') borderColor = 'border-red-500';

  return new L.Icon({
    iconUrl: '/images/robot/robot-face-icon.svg',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -15],
    className: `rounded-full border-2 ${borderColor} shadow-lg`
  });
}

function getRobotStatusClassName(status: RobotStatus) {
  if (status === 'Serving') return 'bg-green-100 text-green-800';
  if (status === 'Returning') return 'bg-blue-100 text-blue-800';
  if (status === 'Waiting') return 'bg-purple-100 text-purple-800';
  return 'bg-red-100 text-red-800';
}

function createDetailRow(label: string, value: string) {
  const row = document.createElement('div');
  row.className = 'flex items-baseline justify-between gap-3';

  const labelEl = document.createElement('span');
  labelEl.className = 'text-xs text-gray-400';
  labelEl.textContent = label;
  row.appendChild(labelEl);

  const valueEl = document.createElement('span');
  valueEl.className = 'text-xs font-medium text-gray-700';
  valueEl.textContent = value;
  row.appendChild(valueEl);

  return row;
}

function createRobotPopup(robot: Robot, orderTableById: Map<string, OrderTableInfo>) {
  const wrapper = document.createElement('div');
  wrapper.className = 'min-w-[160px] text-sm';

  const header = document.createElement('div');
  header.className = 'flex items-center justify-between gap-3';

  const name = document.createElement('strong');
  name.className = 'text-gray-900';
  name.textContent = robot.name;
  header.appendChild(name);

  const status = document.createElement('span');
  status.className = `inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${getRobotStatusClassName(robot.status)}`;
  status.textContent = robot.status;
  header.appendChild(status);

  wrapper.appendChild(header);

  if (robot.status === 'Serving' && robot.orderId) {
    const orderTable = orderTableById.get(robot.orderId);

    if (orderTable) {
      const details = document.createElement('div');
      details.className = 'mt-2 space-y-1 border-t border-gray-100 pt-2';

      details.appendChild(createDetailRow('Order', `#${orderTable.displayId}`));
      details.appendChild(createDetailRow('Table', orderTable.tableNo));

      const itemsLabel = document.createElement('div');
      itemsLabel.className = 'text-xs text-gray-400';
      itemsLabel.textContent = 'Items';
      details.appendChild(itemsLabel);

      if (orderTable.items && orderTable.items.length > 0) {
        const itemsList = document.createElement('ul');
        itemsList.className = 'max-w-[220px] list-disc space-y-0.5 pl-4 text-xs text-gray-600';

        orderTable.items.forEach((item) => {
          const li = document.createElement('li');
          li.textContent = formatOrderItemLine(item);
          itemsList.appendChild(li);
        });

        details.appendChild(itemsList);
      } else {
        const noItems = document.createElement('div');
        noItems.className = 'text-xs text-gray-500';
        noItems.textContent = 'No items';
        details.appendChild(noItems);
      }

      wrapper.appendChild(details);
    }
  }

  return wrapper;
}

function robotPoseToFloorplanPoint(robot: Robot, manifest: MapManifest): [number, number] {
  const floorplanX = (robot.x - manifest.origin[0]) / manifest.resolution;
  const floorplanY = (robot.y - manifest.origin[1]) / manifest.resolution;

  return [floorplanY, floorplanX];
}

function createRobotMarker(robot: Robot, manifest: MapManifest, orderTableById: Map<string, OrderTableInfo>) {
  const marker = L.marker(robotPoseToFloorplanPoint(robot, manifest), { icon: getRobotIcon(robot.status) })
    .bindPopup(createRobotPopup(robot, orderTableById));

  marker.on("mouseover", () => marker.openPopup());
  marker.on("mouseout", () => marker.closePopup());

  return marker;
}

function cancelRobotMarkerAnimation(state: RobotMarkerState) {
  if (state.animationFrameId !== null) {
    window.cancelAnimationFrame(state.animationFrameId);
    state.animationFrameId = null;
  }
}

function updateRobotMarker(
  state: RobotMarkerState,
  robot: Robot,
  manifest: MapManifest,
  orderTableById: Map<string, OrderTableInfo>,
) {
  const targetLatLng = L.latLng(robotPoseToFloorplanPoint(robot, manifest));
  const currentLatLng = state.marker.getLatLng();
  const deltaLat = targetLatLng.lat - currentLatLng.lat;
  const deltaLng = targetLatLng.lng - currentLatLng.lng;
  const moveDistance = Math.hypot(deltaLat, deltaLng);

  state.marker.setIcon(getRobotIcon(robot.status));
  state.marker.bindPopup(createRobotPopup(robot, orderTableById));

  if (moveDistance <= ROBOT_MARKER_SNAP_DISTANCE) {
    cancelRobotMarkerAnimation(state);
    state.marker.setLatLng(targetLatLng);
    return;
  }

  cancelRobotMarkerAnimation(state);

  const startLat = currentLatLng.lat;
  const startLng = currentLatLng.lng;
  const animationStart = performance.now();

  const step = (now: number) => {
    const progress = Math.min((now - animationStart) / ROBOT_MARKER_ANIMATION_DURATION_MS, 1);
    let easedProgress: number;
    if (progress < 0.5) {
      easedProgress = 4 * progress * progress * progress;
    } else {
      const p = 1 - progress;
      easedProgress = 1 - (p * p * p) / 2;
    }

    state.marker.setLatLng([
      startLat + deltaLat * easedProgress,
      startLng + deltaLng * easedProgress,
    ]);

    if (progress < 1) {
      state.animationFrameId = window.requestAnimationFrame(step);
      return;
    }

    state.marker.setLatLng(targetLatLng);
    state.animationFrameId = null;
  };

  state.animationFrameId = window.requestAnimationFrame(step);
}

function syncRobotMarkers(
  markerGroup: L.LayerGroup,
  markerStates: React.MutableRefObject<Map<number, RobotMarkerState>>,
  robots: Robot[],
  manifest: MapManifest,
  orderTableById: Map<string, OrderTableInfo>,
) {
  const nextRobotIds = new Set<number>();

  robots.forEach((robot: Robot) => {
    nextRobotIds.add(robot.id);

    const existingState = markerStates.current.get(robot.id);

    if (!existingState) {
      const marker = createRobotMarker(robot, manifest, orderTableById).addTo(markerGroup);

      markerStates.current.set(robot.id, {
        marker,
        animationFrameId: null,
      });

      return;
    }

    updateRobotMarker(existingState, robot, manifest, orderTableById);
  });

  markerStates.current.forEach((state, robotId) => {
    if (nextRobotIds.has(robotId)) {
      return;
    }

    cancelRobotMarkerAnimation(state);
    markerGroup.removeLayer(state.marker);
    markerStates.current.delete(robotId);
  });
}

function getFitZoom(map: L.Map, bounds: FloorplanBounds) {
  const mapSize = map.getSize();
  const boundsHeight = bounds[1][0] - bounds[0][0];
  const boundsWidth = bounds[1][1] - bounds[0][1];

  if (mapSize.x <= 0 || mapSize.y <= 0 || boundsWidth <= 0 || boundsHeight <= 0) {
    return map.getZoom();
  }

  // Math.min (rather than max) keeps the whole floorplan inside the
  // window on every axis — the widget's window fits the map, instead of
  // the map covering the window and cropping whichever axis overflows.
  const fitScale = Math.min(mapSize.x / boundsWidth, mapSize.y / boundsHeight);
  const fitZoom = Math.log2(fitScale);

  // Clamp against the map's fixed zoom range, not map.getMinZoom(), which
  // this same function's caller mutates on every resize — using the live
  // value here would turn minZoom into a one-way ratchet across resizes.
  return Math.max(MAP_MIN_ZOOM, Math.min(MAP_MAX_ZOOM, fitZoom));
}

function applyFitView(map: L.Map, bounds: FloorplanBounds) {
  const center = L.latLngBounds(bounds).getCenter();
  const zoom = getFitZoom(map, bounds);

  map.setMinZoom(zoom);
  map.setView(center, zoom, { animate: false });
}

function RecenterButton({ onClick }: { onClick: () => void }) {
  return (
    <div className="absolute top-4 right-4 z-[1000]">
      <button
        onClick={onClick}
        className="flex items-center justify-center w-10 h-10 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg shadow-lg dark:bg-gray-800 dark:hover:bg-gray-700 dark:border-gray-600"
        title="Recenter"
      >
        <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>
    </div>
  );
}

export default function RestaurantMap() {
  const { robots, orders } = useRobotContext();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerGroupRef = useRef<L.LayerGroup | null>(null);
  const markerStatesRef = useRef<Map<number, RobotMarkerState>>(new Map());
  const frameRef = useRef<number | null>(null);
  const [loadedMap, setLoadedMap] = useState<LoadedMap | null>(null);

  const orderTableById = useMemo(() => buildOrderTableIndex(orders), [orders]);

  useEffect(() => {
    let active = true;

    fetch(MAP_MANIFEST_URL)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load map manifest: ${response.status}`);
        }

        return response.json() as Promise<MapManifest>;
      })
      .then((manifest) => {
        if (!active) {
          return;
        }

        const [imageWidth, imageHeight] = manifest.imageSizePx;
        setLoadedMap({
          manifest,
          bounds: [[0, 0], [imageHeight, imageWidth]],
        });
      })
      .catch((error) => {
        console.warn("Unable to load map manifest", error);
      });

    return () => {
      active = false;
    };
  }, []);

  useLayoutEffect(() => {
    const container = containerRef.current;

    if (!loadedMap || !container) {
      return;
    }

    const { bounds, manifest } = loadedMap;
    const map = L.map(container, {
      crs: L.CRS.Simple,
      maxBounds: bounds,
      maxBoundsViscosity: 1,
      minZoom: MAP_MIN_ZOOM,
      maxZoom: MAP_MAX_ZOOM,
      zoomDelta: 0.5,
      zoomSnap: 0,
      attributionControl: false,
    });

    mapRef.current = map;
    L.imageOverlay(manifest.imageUrl, bounds).addTo(map);
    const markerGroup = L.layerGroup().addTo(map);
    markerGroupRef.current = markerGroup;
    syncRobotMarkers(markerGroup, markerStatesRef, robots, manifest, orderTableById);

    const refreshMapSize = () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }

      frameRef.current = window.requestAnimationFrame(() => {
        map.invalidateSize({ animate: false });
        applyFitView(map, bounds);
        frameRef.current = null;
      });
    };

    refreshMapSize();

    const resizeObserver = new ResizeObserver(refreshMapSize);
    resizeObserver.observe(container);

    const recenterAtMinZoom = () => {
      if (map.getZoom() <= map.getMinZoom() + 1e-6) {
        map.panTo(L.latLngBounds(bounds).getCenter(), { animate: false });
      }
    };

    map.on("zoomend", recenterAtMinZoom);

    const handleResetView = () => applyFitView(map, bounds);
    window.addEventListener(DASHBOARD_RESET_VIEW_EVENT, handleResetView);

    return () => {
      window.removeEventListener(DASHBOARD_RESET_VIEW_EVENT, handleResetView);
      map.off("zoomend", recenterAtMinZoom);
      resizeObserver.disconnect();

      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }

      markerStatesRef.current.forEach((state) => cancelRobotMarkerAnimation(state));
      markerStatesRef.current.clear();
      markerGroupRef.current?.clearLayers();
      markerGroupRef.current = null;
      mapRef.current = null;

      try {
        map.remove();
      } catch (error) {
        console.warn("Leaflet map cleanup failed", error);
      }
    };
  }, [loadedMap]);

  useEffect(() => {
    const markerGroup = markerGroupRef.current;

    if (!markerGroup || !loadedMap) {
      return;
    }

    syncRobotMarkers(markerGroup, markerStatesRef, robots, loadedMap.manifest, orderTableById);
  }, [robots, loadedMap, orderTableById]);

  if (!loadedMap) {
    return <div className="h-full w-full rounded-lg bg-gray-100" />;
  }

  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg">
      <div ref={containerRef} className="h-full w-full rounded-lg bg-gray-100" />
      <RecenterButton onClick={() => mapRef.current && applyFitView(mapRef.current, loadedMap.bounds)} />
    </div>
  );
}
