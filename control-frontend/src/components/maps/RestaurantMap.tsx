import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useRobotContext } from '../../context/RobotWebSocketProvider';
import type { Robot, RobotStatus } from '../../types/Robot';


const FLOORPLAN_URL = "/maps/the-hive-floorplan-landscape.webp";
type FloorplanBounds = [[number, number], [number, number]];

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

function syncRobotMarkers(markerGroup: L.LayerGroup, robots: Robot[]) {
  markerGroup.clearLayers();

  robots.forEach((robot: Robot) => {
    L.marker([robot.x, robot.y], { icon: getRobotIcon(robot.status) })
      .bindPopup(createRobotPopup(robot))
      .addTo(markerGroup);
  });
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
  const frameRef = useRef<number | null>(null);
  const [bounds, setBounds] = useState<FloorplanBounds | null>(null);

  useEffect(() => {
    let isMounted = true;
    const image = new Image();

    image.onload = () => {
      if (isMounted) {
        setBounds([[0, 0], [image.naturalHeight, image.naturalWidth]]);
      }
    };
    image.src = FLOORPLAN_URL;

    return () => {
      isMounted = false;
      image.onload = null;
    };
  }, []);

  useLayoutEffect(() => {
    const container = containerRef.current;

    if (!bounds || !container) {
      return;
    }

    const map = L.map(container, {
      crs: L.CRS.Simple,
      maxBounds: bounds,
      maxBoundsViscosity: 1,
      minZoom: -3,
      maxZoom: 2,
      attributionControl: false,
    });

    mapRef.current = map;
    L.imageOverlay(FLOORPLAN_URL, bounds).addTo(map);
    const markerGroup = L.layerGroup().addTo(map);
    markerGroupRef.current = markerGroup;
    syncRobotMarkers(markerGroup, robots);
    map.fitBounds(bounds);

    const refreshMapSize = () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }

      frameRef.current = window.requestAnimationFrame(() => {
        map.invalidateSize({ animate: false });
        map.fitBounds(bounds);
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

      markerGroupRef.current?.clearLayers();
      markerGroupRef.current = null;
      mapRef.current = null;

      try {
        map.remove();
      } catch (error) {
        console.warn("Leaflet map cleanup failed", error);
      }
    };
  }, [bounds]);

  useEffect(() => {
    const markerGroup = markerGroupRef.current;

    if (!markerGroup) {
      return;
    }

    syncRobotMarkers(markerGroup, robots);
  }, [robots]);

  if (!bounds) {
    return <div className="h-full w-full rounded-lg bg-gray-100" />;
  }

  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg">
      <div ref={containerRef} className="h-full w-full rounded-lg bg-gray-100" />
      <RecenterButton onClick={() => mapRef.current?.fitBounds(bounds)} />
    </div>
  );
}
