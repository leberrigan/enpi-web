import Link from 'next/link';
import type { FleetDevice, DeviceStatus } from '@/types';

interface Props {
  devices: FleetDevice[];
}

const statusStyle: Record<DeviceStatus, string> = {
  active: 'bg-green-100 text-green-700',
  stale: 'bg-yellow-100 text-yellow-700',
  offline: 'bg-red-100 text-red-700',
  unknown: 'bg-gray-100 text-gray-500',
};

export default function FleetTable({ devices }: Props) {
  const sorted = [...devices].sort((a, b) => b.record.lastSeen.localeCompare(a.record.lastSeen));

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden h-full">
      <div className="px-4 py-3 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-700">Devices</h3>
      </div>
      <div className="overflow-y-auto max-h-96">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100">
              <th className="px-4 py-2">Device / Station</th>
              <th className="px-4 py-2">Last Upload</th>
              <th className="px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {sorted.map((d) => {
              const hasLocation = d.motus && d.motus.latitude !== 0 && d.motus.longitude !== 0;
              return (
              <tr key={d.deviceId} className="hover:bg-gray-50 cursor-pointer">
                <td className="px-4 py-3">
                  <Link href={`/device/${encodeURIComponent(d.deviceId)}`} className="block">
                    <p className="font-medium text-gray-900 text-xs">
                      {d.motus?.stationName ?? d.deviceId}
                    </p>
                    <p className="text-gray-400 text-xs font-mono">{d.deviceId}</p>
                    {!hasLocation && (
                      <p className="text-xs text-amber-600 mt-0.5" title="This device has no coordinates in the Motus database and will not appear on the map">
                        No map location
                      </p>
                    )}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">
                  {d.record.lastSeen}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusStyle[d.status]}`}>
                    {d.status}
                  </span>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
