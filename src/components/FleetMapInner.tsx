'use client';

import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import { useRouter } from 'next/navigation';
import type { FleetDevice, DeviceStatus } from '@/types';
import 'leaflet/dist/leaflet.css';

interface Props {
  devices: FleetDevice[];
}

const statusColor: Record<DeviceStatus, string> = {
  active: '#16a34a',
  stale: '#ca8a04',
  offline: '#dc2626',
  unknown: '#6b7280',
};

export default function FleetMapInner({ devices }: Props) {
  const router = useRouter();

  const center: [number, number] =
    devices.length > 0
      ? [
          devices.reduce((s, d) => s + (d.motus?.latitude ?? 0), 0) / devices.length,
          devices.reduce((s, d) => s + (d.motus?.longitude ?? 0), 0) / devices.length,
        ]
      : [45, -75];

  return (
    <MapContainer
      center={center}
      zoom={devices.length === 1 ? 8 : 4}
      style={{ height: '380px', width: '100%', borderRadius: '0.75rem' }}
      className="z-0"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {devices.map((d) => {
        if (!d.motus) return null;
        return (
          <CircleMarker
            key={d.deviceId}
            center={[d.motus.latitude, d.motus.longitude]}
            radius={10}
            pathOptions={{
              fillColor: statusColor[d.status],
              color: '#fff',
              weight: 2,
              fillOpacity: 0.9,
            }}
            eventHandlers={{
              click: () => router.push(`/device/${encodeURIComponent(d.deviceId)}`),
            }}
          >
            <Popup>
              <div className="text-sm">
                <p className="font-semibold">{d.motus.stationName}</p>
                <p className="text-gray-500 font-mono text-xs">{d.deviceId}</p>
                <p className="text-gray-600 mt-1">Last upload: {d.record.lastSeen}</p>
                <button
                  onClick={() => router.push(`/device/${encodeURIComponent(d.deviceId)}`)}
                  className="mt-2 text-blue-600 hover:underline text-xs"
                >
                  View details →
                </button>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
