import NavBar from '@/components/NavBar';
import FleetTable from '@/components/FleetTable';
import FleetMap from '@/components/FleetMap';
import StatusCards from '@/components/StatusCards';
import { getFleetManifest } from '@/lib/s3';
import { buildFleetDevices } from '@/lib/fleet';
import type { FleetDevice } from '@/types';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  let devices: FleetDevice[] = [];
  let updatedAt: string | null = null;

  try {
    const manifest = await getFleetManifest();
    if (manifest) {
      devices = await buildFleetDevices(manifest);
      updatedAt = manifest.updatedAt;
    }
  } catch (e) {
    console.error('Failed to load fleet manifest:', e);
  }

  const mappableDevices = devices.filter(
    (d) => d.motus && d.motus.latitude !== 0 && d.motus.longitude !== 0,
  );

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Fleet Overview</h2>
          {updatedAt && (
            <span className="text-xs text-gray-400">
              Last synced {new Date(updatedAt).toLocaleString()}
            </span>
          )}
        </div>

        <StatusCards devices={devices} />

        {devices.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
            <p className="text-lg font-medium">No devices found</p>
            <p className="text-sm mt-1">
              Data will appear here once devices start uploading to S3 and the Lambda
              processor has run.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-3">
              <FleetMap devices={mappableDevices} />
            </div>
            <div className="lg:col-span-2">
              <FleetTable devices={devices} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
