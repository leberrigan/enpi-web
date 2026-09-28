import type { FleetDevice } from '@/types';

interface Props {
  devices: FleetDevice[];
}

export default function StatusCards({ devices }: Props) {
  const total = devices.length;
  const activeWithSensors = devices.filter((d) => d.status === 'active' && d.hasData).length;
  const activeWithoutSensors = devices.filter((d) => d.status === 'active' && !d.hasData).length;
  const staleWithSensors = devices.filter((d) => d.status === 'stale' && d.hasData).length;
  const offlineWithSensors = devices.filter((d) => d.status === 'offline' && d.hasData).length;

  const cards = [
    { label: 'Total Devices', value: total, color: 'text-gray-900' },
    { label: 'Active with sensors', value: activeWithSensors, color: 'text-green-600' },
    { label: 'Active without sensors', value: activeWithoutSensors, color: 'text-gray-500' },
    { label: 'Stale with sensors', value: staleWithSensors, color: 'text-yellow-600' },
    { label: 'Offline with sensors', value: offlineWithSensors, color: 'text-red-600' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
      {cards.map((c) => (
        <div key={c.label} className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">{c.label}</p>
          <p className={`text-3xl font-bold mt-1 ${c.color}`}>{c.value}</p>
        </div>
      ))}
    </div>
  );
}
