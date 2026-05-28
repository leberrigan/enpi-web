import dynamic from 'next/dynamic';
import type { FleetDevice } from '@/types';

const FleetMapInner = dynamic(() => import('./FleetMapInner'), {
  ssr: false,
  loading: () => (
    <div className="h-96 bg-gray-100 rounded-xl animate-pulse flex items-center justify-center text-gray-400 text-sm">
      Loading map...
    </div>
  ),
});

interface Props {
  devices: FleetDevice[];
}

export default function FleetMap({ devices }: Props) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden p-2">
      <FleetMapInner devices={devices} />
    </div>
  );
}
