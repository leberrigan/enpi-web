'use client';

import L from 'leaflet';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

interface Props {
  latitude: number | null;
  longitude: number | null;
  onChange: (lat: number, lon: number) => void;
}

const pinIcon = L.divIcon({
  className: '',
  html: '<div style="width:18px;height:18px;border-radius:50% 50% 50% 0;background:#2563eb;border:2px solid #fff;transform:rotate(-45deg);box-shadow:0 1px 3px rgba(0,0,0,0.4);"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 18],
  popupAnchor: [0, -18],
});

function ClickHandler({ onChange }: { onChange: (lat: number, lon: number) => void }) {
  useMapEvents({
    click(e) {
      onChange(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function LocationPicker({ latitude, longitude, onChange }: Props) {
  const hasLocation = latitude != null && longitude != null;
  const center: [number, number] = hasLocation ? [latitude!, longitude!] : [45, -75];

  return (
    <MapContainer
      center={center}
      zoom={hasLocation ? 11 : 4}
      style={{ height: '240px', width: '100%', borderRadius: '0.5rem' }}
      className="z-0"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ClickHandler onChange={onChange} />
      {hasLocation && <Marker position={[latitude!, longitude!]} icon={pinIcon} />}
    </MapContainer>
  );
}
