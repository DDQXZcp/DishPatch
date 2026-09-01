import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useRobotContext } from '../../context/RobotWebSocketProvider';
import {
  useDashboardHighlight,
  useDashboardSelection,
} from '../../context/DashboardSelectionContext';
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
interface TrailDot {
  circle: L.CircleMarker;
  createdAt: number;
  status: RobotStatus;
}

interface RobotMarkerState {
  marker: L.Marker;
  animationFrameId: number | null;
  trailDots: TrailDot[];
  lastTrailPoint: L.LatLng | null;
  lastTrailSpawnAt: number | null;
  /** Last popup content this marker was given; see getPopupContentKey. */
  popupContentKey: string;
  isHighlighted: boolean;
}

const ROBOT_MARKER_ANIMATION_DURATION_MS = 120;
const ROBOT_MARKER_SNAP_DISTANCE = 0.01;
const MAP_MIN_ZOOM = -3;
const MAP_MAX_ZOOM = 2;
const TRAIL_DOT_RADIUS = 2.5;
const TRAIL_OPACITY = 0.75;
const TRAIL_DURATION = 10000;
const TRAIL_SPAWN_INTERVAL_MS = 1000;
const TRAIL_MAX_DOTS = 6;

// Fix for default Leaflet markers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

function getRobotIcon(status: RobotStatus, yaw: number, isHighlighted: boolean) {
  let borderColor = '';

  if (status === 'Serving') borderColor = 'border-green-500';
  else if (status === 'Returning') borderColor = 'border-blue-500';
  else if (status === 'Waiting') borderColor = 'border-purple-500';
  else if (status === 'Maintenance') borderColor = 'border-red-500';

  // World yaw is radians counter-clockwise from +x (screen-right); the arrow
  // graphic points up by default, so convert to a clockwise CSS angle from up.
  const headingDeg = 90 - (yaw * 180) / Math.PI;

  // The selection halo is deliberately static. This whole element is rebuilt on
  // every telemetry tick to move the heading arrow, so a CSS animation here
  // would restart ten times a second and read as a flicker rather than a pulse.
  const halo = isHighlighted
    ? '<span class="absolute -inset-2 rounded-full border-2 border-brand-500 bg-brand-500/20"></span>'
    : '';

  return L.divIcon({
    html: `
      <div class="relative w-[30px] h-[30px]">
        ${halo}
        <img src="/images/robot/robot-face-icon.svg" class="relative w-full h-full rounded-full border-2 ${borderColor} shadow-lg" />
        <div class="absolute inset-0" style="transform: rotate(${headingDeg}deg);">
          <div class="absolute left-1/2 top-[-4px] -translate-x-1/2 w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-b-[6px] border-b-gray-800"></div>
        </div>
      </div>
    `,
    className: '',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -15],
  });
}

function getRobotStatusClassName(status: RobotStatus) {
  if (status === 'Serving') return 'bg-green-100 text-green-800';
  if (status === 'Returning') return 'bg-blue-100 text-blue-800';
  if (status === 'Waiting') return 'bg-purple-100 text-purple-800';
  return 'bg-red-100 text-red-800';
}

function getRobotStatusColor(status: RobotStatus): string {
  if (status === 'Serving') return '#22c55e';
  if (status === 'Returning') return '#3b82f6';
  if (status === 'Waiting') return '#a855f7';
  return '#ef4444';
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

/**
 * Everything the popup actually renders, flattened. Pose is deliberately absent:
 * the popup content is rebuilt only when this key changes, so a robot driving
 * across the room does not rebuild its popup DOM on every telemetry tick.
 */
function getPopupContentKey(robot: Robot, orderTableById: Map<string, OrderTableInfo>) {
  const orderTable = robot.orderId ? orderTableById.get(robot.orderId) : undefined;

  return [
    robot.name,
    robot.status,
    robot.orderId ?? '',
    orderTable?.displayId ?? '',
    orderTable?.tableNo ?? '',
    orderTable?.items.length ?? 0,
  ].join('|');
}

function createRobotMarker(
  robot: Robot,
  manifest: MapManifest,
  orderTableById: Map<string, OrderTableInfo>,
  isHighlighted: boolean,
  onSelect: (robotId: number) => void,
) {
  const marker = L.marker(robotPoseToFloorplanPoint(robot, manifest), {
    icon: getRobotIcon(robot.status, robot.yaw, isHighlighted),
    // No close button: this popup is a view of the selection, not something
    // that can be dismissed on its own. Deselect via the marker, bare
    // floorplan, or Escape.
  }).bindPopup(createRobotPopup(robot, orderTableById), { closeButton: false });

  // The popup is no longer a hover artifact — it belongs to whichever robot is
  // selected, so a click here is what opens it, and clicking again closes it.
  marker.on("click", (event) => {
    // Leaflet does not forward a click on an interactive layer to the map, but
    // stopping it explicitly keeps this independent of that detail: the map's
    // own click handler clears the selection this click is making.
    L.DomEvent.stop(event);
    onSelect(robot.id);
  });

  return marker;
}

function cancelRobotMarkerAnimation(state: RobotMarkerState) {
  if (state.animationFrameId !== null) {
    window.cancelAnimationFrame(state.animationFrameId);
    state.animationFrameId = null;
  }
}

/**
 * Opens the popup for the selected robot and closes everyone else's.
 *
 * Asserted from the selection on every sync rather than only on transitions.
 * Leaflet binds its own click-to-toggle handler inside `bindPopup`, so the
 * popup can be flipped without the selection knowing; a transition guard would
 * then see "already highlighted" and refuse to put it back. Re-asserting makes
 * the selection the single source of truth and costs two booleans per tick.
 */
function applyMarkerHighlight(state: RobotMarkerState, isHighlighted: boolean) {
  state.isHighlighted = isHighlighted;

  const isPopupOpen = state.marker.isPopupOpen();

  if (isHighlighted && !isPopupOpen) {
    state.marker.openPopup();
  } else if (!isHighlighted && isPopupOpen) {
    state.marker.closePopup();
  }
}

function updateRobotMarker(
  state: RobotMarkerState,
  robot: Robot,
  manifest: MapManifest,
  orderTableById: Map<string, OrderTableInfo>,
  markerGroup: L.LayerGroup,
  isHighlighted: boolean,
) {
  const targetLatLng = L.latLng(robotPoseToFloorplanPoint(robot, manifest));
  const currentLatLng = state.marker.getLatLng();
  const deltaLat = targetLatLng.lat - currentLatLng.lat;
  const deltaLng = targetLatLng.lng - currentLatLng.lng;
  const moveDistance = Math.hypot(deltaLat, deltaLng);

  state.marker.setIcon(getRobotIcon(robot.status, robot.yaw, isHighlighted));

  // Rebuild the popup only when what it says has changed. This used to run on
  // every tick, which was tolerable while popups only existed for as long as a
  // cursor hovered; now that a selected robot's popup stays open, replacing its
  // DOM ten times a second is visible.
  const popupContentKey = getPopupContentKey(robot, orderTableById);

  if (popupContentKey !== state.popupContentKey) {
    state.popupContentKey = popupContentKey;
    state.marker.setPopupContent(createRobotPopup(robot, orderTableById));
  }

  applyMarkerHighlight(state, isHighlighted);

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
    const progress = Math.min(
      Math.max((now - animationStart) / ROBOT_MARKER_ANIMATION_DURATION_MS, 0),
      1,
    );

    const newLatLng = L.latLng(
      startLat + deltaLat * progress,
      startLng + deltaLng * progress,
    );

    state.marker.setLatLng(newLatLng);

    // lastTrailSpawnAt deliberately survives across animations, so the trail is
    // paced by wall-clock and not by how often status arrives.
    if (state.lastTrailSpawnAt === null || now - state.lastTrailSpawnAt >= TRAIL_SPAWN_INTERVAL_MS) {
      spawnTrailDot(state, newLatLng, markerGroup, getRobotStatusColor(robot.status), robot.status);
      state.lastTrailSpawnAt = now;
    }

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
  highlightedRobotId: number | null,
  onSelect: (robotId: number) => void,
) {
  const nextRobotIds = new Set<number>();

  robots.forEach((robot: Robot) => {
    nextRobotIds.add(robot.id);

    const isHighlighted = robot.id === highlightedRobotId;
    const existingState = markerStates.current.get(robot.id);

    if (!existingState) {
      const marker = createRobotMarker(
        robot,
        manifest,
        orderTableById,
        isHighlighted,
        onSelect,
      ).addTo(markerGroup);

      const state: RobotMarkerState = {
        marker,
        animationFrameId: null,
        trailDots: [],
        lastTrailPoint: null,
        lastTrailSpawnAt: null,
        popupContentKey: getPopupContentKey(robot, orderTableById),
        isHighlighted: false,
      };

      markerStates.current.set(robot.id, state);
      // Goes through the same path as an update so a robot that reappears
      // while it is the selected one comes back with its popup already open.
      applyMarkerHighlight(state, isHighlighted);

      return;
    }

    updateRobotMarker(
      existingState,
      robot,
      manifest,
      orderTableById,
      markerGroup,
      isHighlighted,
    );
  });

  markerStates.current.forEach((state, robotId) => {
    if (nextRobotIds.has(robotId)) {
      return;
    }

    cancelRobotMarkerAnimation(state);
    removeAllTrailDots(state);
    markerGroup.removeLayer(state.marker);
    markerStates.current.delete(robotId);
  });
}

function spawnTrailDot(state: RobotMarkerState, latlng: L.LatLng, markerGroup: L.LayerGroup, color: string, status: RobotStatus) {
  const circle = L.circleMarker(latlng, {
    radius: TRAIL_DOT_RADIUS,
    color,
    fillColor: color,
    fillOpacity: TRAIL_OPACITY,
    opacity: TRAIL_OPACITY,
    weight: 0,
    stroke: false,
    interactive: false
  }).addTo(markerGroup);

  const dot: TrailDot = { circle, createdAt: performance.now(), status };
  state.trailDots.push(dot);
  state.lastTrailPoint = latlng;

  if (state.trailDots.length > TRAIL_MAX_DOTS) {
    const oldest = state.trailDots.shift();
    oldest?.circle.remove();
  }
}

function getTrailFadeMult(status: RobotStatus): number {
  return status === 'Waiting' ? 2 : 1;
}

function fadeTrailDots(state: RobotMarkerState) {
  const now = performance.now();

  state.trailDots = state.trailDots.filter((dot) => {
    const age = now - dot.createdAt;
    const mult = getTrailFadeMult(dot.status)
    const life = age / (TRAIL_DURATION / mult);

    if (life >= 1) {
      dot.circle.remove();
      return false;
    }

    dot.circle.setStyle({ fillOpacity: TRAIL_OPACITY * (1 - life), opacity: TRAIL_OPACITY * (1 - life), stroke: false, weight: 0 });
    return true;
  });
}

function removeAllTrailDots(state: RobotMarkerState) {
  state.trailDots.forEach((dot) => dot.circle.remove());
  state.trailDots = [];
}

function getFitZoom(map: L.Map, bounds: FloorplanBounds) {
  const mapSize = map.getSize();
  const boundsHeight = bounds[1][0] - bounds[0][0];
  const boundsWidth = bounds[1][1] - bounds[0][1];

  if (mapSize.x <= 0 || mapSize.y <= 0 || boundsWidth <= 0 || boundsHeight <= 0) {
    return map.getZoom();
  }

  // Math.min (rather than max) keeps the whole floorplan inside the
  // window on every axis — equivalent to preserveAspectRatio="xMidYMid
  // meet". No part of the map is ever cropped; any leftover space is
  // centered letterboxing on whichever axis doesn't match.
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
  const { selectRobot, clearSelection } = useDashboardSelection();
  const { highlightedRobotId } = useDashboardHighlight();
  // Markers and the map's own click handler are wired up once and then only
  // mutated, so they must not capture a callback from the render that created
  // them. Reading through a ref keeps them on the current one.
  const selectRobotRef = useRef(selectRobot);
  const clearSelectionRef = useRef(clearSelection);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerGroupRef = useRef<L.LayerGroup | null>(null);
  const markerStatesRef = useRef<Map<number, RobotMarkerState>>(new Map());
  const frameRef = useRef<number | null>(null);
  const [loadedMap, setLoadedMap] = useState<LoadedMap | null>(null);

  const orderTableById = useMemo(() => buildOrderTableIndex(orders), [orders]);

  useEffect(() => {
    selectRobotRef.current = selectRobot;
    clearSelectionRef.current = clearSelection;
  }, [selectRobot, clearSelection]);

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

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      markerStatesRef.current.forEach((state) => {
        if (state.trailDots.length > 0) {
          fadeTrailDots(state);
        }
      });
    }, 100);

    return () => window.clearInterval(intervalId);
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
      center: L.latLngBounds(bounds).getCenter(),
      zoom: MAP_MIN_ZOOM,
    });

    mapRef.current = map;
    L.imageOverlay(manifest.imageUrl, bounds).addTo(map);
    const markerGroup = L.layerGroup().addTo(map);
    markerGroupRef.current = markerGroup;
    syncRobotMarkers(
      markerGroup,
      markerStatesRef,
      robots,
      manifest,
      orderTableById,
      highlightedRobotId,
      (robotId) => selectRobotRef.current(robotId),
    );

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

    // Clicking bare floorplan is how you let go of the current selection.
    // Marker clicks stop before they reach here.
    const handleMapClick = () => clearSelectionRef.current();
    map.on("click", handleMapClick);

    const handleResetView = () => applyFitView(map, bounds);
    window.addEventListener(DASHBOARD_RESET_VIEW_EVENT, handleResetView);

    return () => {
      window.removeEventListener(DASHBOARD_RESET_VIEW_EVENT, handleResetView);
      map.off("click", handleMapClick);
      map.off("zoomend", recenterAtMinZoom);
      resizeObserver.disconnect();

      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }

      markerStatesRef.current.forEach((state) => { cancelRobotMarkerAnimation(state); removeAllTrailDots(state); });
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

    syncRobotMarkers(
      markerGroup,
      markerStatesRef,
      robots,
      loadedMap.manifest,
      orderTableById,
      highlightedRobotId,
      (robotId) => selectRobotRef.current(robotId),
    );
  }, [robots, loadedMap, orderTableById, highlightedRobotId]);

  if (!loadedMap) {
    return <div className="h-full w-full rounded-lg" style={{ backgroundColor: '#ffffff' }} />;
  }

  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg">
      {/* Leaflet's own stylesheet sets .leaflet-container background to #ddd;
          an inline style is needed to win over that rule. */}
      <div ref={containerRef} className="h-full w-full rounded-lg" style={{ backgroundColor: '#ffffff' }} />
      <RecenterButton onClick={() => mapRef.current && applyFitView(mapRef.current, loadedMap.bounds)} />
    </div>
  );
}
