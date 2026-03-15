import { useContext } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useScooterContext } from '../../context/ScooterWebSocketProvider';
import { Scooter } from '../../types/Scooter';

// Fix for default markers in react-leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// ANU campus coordinates
const ANU_CENTER: [number, number] = [-35.276781489695345, 149.12011959981004];
const ZOOM_LEVEL = 16;

function getScooterIcon(status: 'Running' | 'Locked' | 'Maintenance') {
  let borderColor = '';

  if (status === 'Running') borderColor = 'border-green-500';
  else if (status === 'Locked') borderColor = 'border-yellow-500';
  else if (status === 'Maintenance') borderColor = 'border-red-500';

  return new L.Icon({
    iconUrl: '/images/scooter/scooter-neuron-icon.jpg',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20],
    className: `rounded-full border-2 ${borderColor} shadow-lg`
  });
}

function RecenterButton() {
  const map = useMap();
  return (
    <div className="absolute top-4 right-4 z-[1000]">
      <button
        onClick={() => map.setView(ANU_CENTER, ZOOM_LEVEL)}
        className="flex items-center justify-center w-10 h-10 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg shadow-lg dark:bg-gray-800 dark:hover:bg-gray-700 dark:border-gray-600"
        title="Recenter to ANU Campus"
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
  const { scooters } = useScooterContext();

  return (
    <div className="h-full w-full rounded-lg overflow-hidden">
      <MapContainer center={ANU_CENTER} zoom={ZOOM_LEVEL} style={{ height: '100%', width: '100%' }} className="rounded-lg">
        <RecenterButton />
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />
        {(scooters as Scooter[]).map((scooter) => (
          <Marker key={scooter.id} position={[scooter.lat, scooter.lng]} icon={getScooterIcon(scooter.status)}>
            <Popup>
              <div className="text-sm">
                <strong>{scooter.name}</strong>
                <br />
                <span className={`inline-block px-2 py-1 rounded-full text-xs ${
                  scooter.status === 'Running' ? 'bg-green-100 text-green-800' :
                  scooter.status === 'Locked' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {scooter.status}
                </span>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}