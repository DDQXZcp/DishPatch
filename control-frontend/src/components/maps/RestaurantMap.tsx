import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useRobotContext } from '../../context/RobotWebSocketProvider';
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
}

interface RobotMarkerState {
  marker: L.Marker;
  animationFrameId: number | null;
  trailDots: TrailDot[];
  lastTrailPoint: L.LatLng | null;
  lastTrailSpawnAt: number | null;
}

const ROBOT_MARKER_ANIMATION_DURATION_MS = 280;
const ROBOT_MARKER_SNAP_DISTANCE = 0.01;
const TRAIL_DOT_RADIUS = 2.5;
const TRAIL_OPACITY = 0.3;
const TRAIL_DURATION = 5000;
const TRAIL_SPAWN_INTERVAL_MS = 5000;
const TRAIL_MAX_DOTS = 5;

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
  else if (status === 'Pickup') borderColor = 'border-yellow-500';
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
  if (status === 'Pickup') return 'bg-yellow-100 text-yellow-800';
  if (status === 'Returning') return 'bg-blue-100 text-blue-800';
  if (status === 'Waiting') return 'bg-purple-100 text-purple-800';
  return 'bg-red-100 text-red-800';
}

function createRobotPopup(robot: Robot) {
  const wrapper = document.createElement('div');
  wrapper.className = 'text-sm';

  const name = document.createElement('strong');
  name.textContent = robot.name;
  wrapper.appendChild(name);
  wrapper.appendChild(document.createElement('br'));

  const status = document.createElement('span');
  status.className = `inline-block px-2 py-1 rounded-full text-xs ${getRobotStatusClassName(robot.status)}`;
  status.textContent = robot.status;
  wrapper.appendChild(status);

  return wrapper;
}

function robotPoseToFloorplanPoint(robot: Robot, manifest: MapManifest): [number, number] {
  const floorplanX = (robot.x - manifest.origin[0]) / manifest.resolution;
  const floorplanY = (robot.y - manifest.origin[1]) / manifest.resolution;

  return [floorplanY, floorplanX];
}

function createRobotMarker(robot: Robot, manifest: MapManifest) {
  return L.marker(robotPoseToFloorplanPoint(robot, manifest), { icon: getRobotIcon(robot.status) })
    .bindPopup(createRobotPopup(robot));
}

function cancelRobotMarkerAnimation(state: RobotMarkerState) {
  if (state.animationFrameId !== null) {
    window.cancelAnimationFrame(state.animationFrameId);
    state.animationFrameId = null;
  }
}

function updateRobotMarker(state: RobotMarkerState, robot: Robot, manifest: MapManifest, markerGroup: L.LayerGroup) {
  const targetLatLng = L.latLng(robotPoseToFloorplanPoint(robot, manifest));
  const currentLatLng = state.marker.getLatLng();
  const deltaLat = targetLatLng.lat - currentLatLng.lat;
  const deltaLng = targetLatLng.lng - currentLatLng.lng;
  const moveDistance = Math.hypot(deltaLat, deltaLng);

  state.marker.setIcon(getRobotIcon(robot.status));
  state.marker.bindPopup(createRobotPopup(robot));

  if (moveDistance <= ROBOT_MARKER_SNAP_DISTANCE) {
    cancelRobotMarkerAnimation(state);
    state.marker.setLatLng(targetLatLng);
    return;
  }

  cancelRobotMarkerAnimation(state);

  const startLat = currentLatLng.lat;
  const startLng = currentLatLng.lng;
  const animationStart = performance.now();
  state.lastTrailSpawnAt = animationStart - TRAIL_SPAWN_INTERVAL_MS;

  const step = (now: number) => {
    const progress = Math.min((now - animationStart) / ROBOT_MARKER_ANIMATION_DURATION_MS, 1);
    let easedProgress: number;
    if (progress < 0.5) {
      easedProgress = 4 * progress * progress * progress;
    } else {
      const p = 1 - progress;
      easedProgress = 1 - (p * p * p) / 2;
    }

    const newLatLng = L.latLng(
      startLat + deltaLat * easedProgress,
      startLng + deltaLng * easedProgress,
    );

    state.marker.setLatLng(newLatLng);

    if (state.lastTrailSpawnAt === null || now - state.lastTrailSpawnAt >= TRAIL_SPAWN_INTERVAL_MS) {
      spawnTrailDot(state, newLatLng, markerGroup);
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
) {
  const nextRobotIds = new Set<number>();

  robots.forEach((robot: Robot) => {
    nextRobotIds.add(robot.id);

    const existingState = markerStates.current.get(robot.id);

    if (!existingState) {
      const marker = createRobotMarker(robot, manifest).addTo(markerGroup);

      markerStates.current.set(robot.id, {
        marker,
        animationFrameId: null,
        trailDots: [],
        lastTrailPoint: null,
        lastTrailSpawnAt: null,
      });

      return;
    }

    updateRobotMarker(existingState, robot, manifest, markerGroup);
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

function spawnTrailDot(state: RobotMarkerState, latlng: L.LatLng, markerGroup: L.LayerGroup) {
  const circle = L.circleMarker(latlng, {
    radius: TRAIL_DOT_RADIUS,
    color: '#ff0015',
    fillOpacity: TRAIL_OPACITY,
    interactive: false
  }).addTo(markerGroup);

  const dot: TrailDot = { circle, createdAt: performance.now() };
  state.trailDots.push(dot);
  state.lastTrailPoint = latlng;

  if (state.trailDots.length > TRAIL_MAX_DOTS) {
    const oldest = state.trailDots.shift();
    oldest?.circle.remove();
  }
}

function fadeTrailDots(state: RobotMarkerState) {
  const now = performance.now();

  state.trailDots = state.trailDots.filter((dot) => {
    const age = now - dot.createdAt;
    const life = age / TRAIL_DURATION;

    if (life >= 1) {
      dot.circle.remove();
      return false;
    }

    dot.circle.setStyle({ fillOpacity: TRAIL_OPACITY * (1 - life) });
    return true;
  });
}

function removeAllTrailDots(state: RobotMarkerState) {
  state.trailDots.forEach((dot) => dot.circle.remove());
  state.trailDots = [];
}

function getCoverZoom(map: L.Map, bounds: FloorplanBounds) {
  const mapSize = map.getSize();
  const boundsHeight = bounds[1][0] - bounds[0][0];
  const boundsWidth = bounds[1][1] - bounds[0][1];

  if (mapSize.x <= 0 || mapSize.y <= 0 || boundsWidth <= 0 || boundsHeight <= 0) {
    return map.getZoom();
  }

  const coverScale = Math.max(mapSize.x / boundsWidth, mapSize.y / boundsHeight);
  const coverZoom = Math.log2(coverScale);
  const minZoom = map.getMinZoom();
  const maxZoom = map.getMaxZoom();

  return Math.max(minZoom, Math.min(maxZoom, coverZoom));
}

function applyCoverView(map: L.Map, bounds: FloorplanBounds) {
  const center = L.latLngBounds(bounds).getCenter();
  const zoom = getCoverZoom(map, bounds);

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
  const { robots } = useRobotContext();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerGroupRef = useRef<L.LayerGroup | null>(null);
  const markerStatesRef = useRef<Map<number, RobotMarkerState>>(new Map());
  const frameRef = useRef<number | null>(null);
  const [loadedMap, setLoadedMap] = useState<LoadedMap | null>(null);

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
      minZoom: -3,
      maxZoom: 2,
      zoomDelta: 0.5,
      zoomSnap: 0,
      attributionControl: false,
    });

    mapRef.current = map;
    L.imageOverlay(manifest.imageUrl, bounds).addTo(map);
    const markerGroup = L.layerGroup().addTo(map);
    markerGroupRef.current = markerGroup;
    syncRobotMarkers(markerGroup, markerStatesRef, robots, manifest);

    const refreshMapSize = () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }

      frameRef.current = window.requestAnimationFrame(() => {
        map.invalidateSize({ animate: false });
        applyCoverView(map, bounds);
        frameRef.current = null;
      });
    };

    refreshMapSize();

    const resizeObserver = new ResizeObserver(refreshMapSize);
    resizeObserver.observe(container);

    return () => {
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

    syncRobotMarkers(markerGroup, markerStatesRef, robots, loadedMap.manifest);
  }, [robots, loadedMap]);

  if (!loadedMap) {
    return <div className="h-full w-full rounded-lg bg-gray-100" />;
  }

  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg">
      <div ref={containerRef} className="h-full w-full rounded-lg bg-gray-100" />
      <RecenterButton onClick={() => mapRef.current && applyCoverView(mapRef.current, loadedMap.bounds)} />
    </div>
  );
}
