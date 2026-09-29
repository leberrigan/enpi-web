'use client';

import L from 'leaflet';
import { MapContainer, TileLayer, CircleMarker, Marker, Popup } from 'react-leaflet';
import { useRouter } from 'next/navigation';
import type { FleetDevice, DeviceStatus } from '@/types';
import 'leaflet/dist/leaflet.css';

interface Props {
  devices: FleetDevice[];
}

// Referencing the shared Motus tokens (/shared/motus-tools.css) rather than
// hardcoded hex, so the map dots match FleetTable's status pills. These are
// raw strings handed to Leaflet, not Tailwind classes, so they need their
// own fallback (Tailwind's config-level fallback doesn't cover this) —
// values match motus-tools.css's own formulas, in case /shared/ 404s (e.g.
// on Vercel).
const statusColor: Record<DeviceStatus, string> = {
  active: 'var(--motus-success, color-mix(in srgb, #9ad54f 70%, black))',
  stale: 'var(--motus-warning, color-mix(in srgb, #eed931 70%, black))',
  offline: 'var(--motus-danger, #da4632)',
  unknown: 'var(--motus-muted, #6c757d)',
};

// Test deployments (manually entered, not from Motus) get a distinct marker:
// a colored ring with a white center and a "T", instead of a solid dot.
function testDeploymentIcon(status: DeviceStatus): L.DivIcon {
  const color = statusColor[status];
  return L.divIcon({
    className: '',
    html: `<div style="width:20px;height:20px;border-radius:50%;background:#fff;border:3px solid ${color};display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:${color};">T</div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    popupAnchor: [0, -10],
  });
}

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
        const popup = (
          <Popup>
            <div className="text-sm">
              <p className="font-semibold">
                {d.motus.stationName}
                {d.motus.isTestDeployment && (
                  <span className="ml-1 text-xs text-motus-secondary font-medium">(test)</span>
                )}
              </p>
              <p className="text-gray-500 font-mono text-xs">{d.deviceId}</p>
              <p className="text-gray-600 mt-1">Last upload: {d.record.lastSeen}</p>
              <button
                onClick={() => router.push(`/device/${encodeURIComponent(d.deviceId)}`)}
                className="mt-2 text-motus-secondary hover:underline text-xs"
              >
                View details →
              </button>
            </div>
          </Popup>
        );

        if (d.motus.isTestDeployment) {
          return (
            <Marker
              key={d.deviceId}
              position={[d.motus.latitude, d.motus.longitude]}
              icon={testDeploymentIcon(d.status)}
              eventHandlers={{
                click: () => router.push(`/device/${encodeURIComponent(d.deviceId)}`),
              }}
            >
              {popup}
            </Marker>
          );
        }

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
            {popup}
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
