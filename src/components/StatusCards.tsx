import type { FleetDevice } from '@/types';

interface Props {
  devices: FleetDevice[];
}

export default function StatusCards({ devices }: Props) {
  const total = devices.length;
  const active = devices.filter((d) => d.status === 'active').length;
  const stale = devices.filter((d) => d.status === 'stale').length;
  const offline = devices.filter((d) => d.status === 'offline').length;

  const cards = [
    { label: 'Total Devices', value: total, color: 'text-gray-900' },
    { label: 'Active', value: active, color: 'text-green-600' },
    { label: 'Stale (2–7d)', value: stale, color: 'text-yellow-600' },
    { label: 'Offline (>7d)', value: offline, color: 'text-red-600' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {cards.map((c) => (
        <div key={c.label} className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">{c.label}</p>
          <p className={`text-3xl font-bold mt-1 ${c.color}`}>{c.value}</p>
        </div>
      ))}
    </div>
  );
}
