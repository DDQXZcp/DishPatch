import { MapContainer, ImageOverlay, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
// import { useScooterContext } from '../../context/ScooterWebSocketProvider';
// import { Scooter } from '../../types/Scooter';

// Fix for default markers in react-leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// function getScooterIcon(status: 'Running' | 'Locked' | 'Maintenance') {
//   let borderColor = '';

//   if (status === 'Running') borderColor = 'border-green-500';
//   else if (status === 'Locked') borderColor = 'border-yellow-500';
//   else if (status === 'Maintenance') borderColor = 'border-red-500';

//   return new L.Icon({
//     iconUrl: '/images/scooter/scooter-neuron-icon.jpg',
//     iconSize: [40, 40],
//     iconAnchor: [20, 20],
//     popupAnchor: [0, -20],
//     className: `rounded-full border-2 ${borderColor} shadow-lg`
//   });
// }

const FLOORPLAN_URL = "/maps/the-hive-floorplan.svg";
const FLOORPLAN_BOUNDS: [[number, number], [number, number]] = [
  [0, 0],
  [2468, 1696],
];

function RecenterButton() {
  const map = useMap();
  return (
    <div className="absolute top-4 right-4 z-[1000]">
      <button
        onClick={() => map.fitBounds(FLOORPLAN_BOUNDS)}
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

export default function ANUCampusMap() {
  // const { scooters } = useScooterContext();

  return (
    <div className="h-full w-full rounded-lg overflow-hidden">
      <MapContainer
        crs={L.CRS.Simple}
        bounds={FLOORPLAN_BOUNDS}
        maxBounds={FLOORPLAN_BOUNDS}
        maxBoundsViscosity={1}
        minZoom={-2}
        maxZoom={2}
        style={{ height: '100%', width: '100%' }}
        className="rounded-lg bg-gray-100"
      >
        <RecenterButton />
        <ImageOverlay
          url={FLOORPLAN_URL}
          bounds={FLOORPLAN_BOUNDS}
        />
      </MapContainer>
    </div>
  );
}
