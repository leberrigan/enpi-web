import NavBar from '@/components/NavBar';
import DeviceSummaryCards from '@/components/DeviceSummaryCards';
import AirCharts from '@/components/AirCharts';
import LightChart from '@/components/LightChart';
import DownloadPanel from '@/components/DownloadPanel';
import TestDeploymentPanel from '@/components/TestDeploymentPanel';
import { getFleetManifest, getAirSummaries, getLightSummaries } from '@/lib/s3';
import { getDeviceLocation, getDeviceTestDeployments } from '@/lib/fleet';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { AirDailySummary, LightDailySummary } from '@/types';

interface PageProps {
  params: { id: string };
  searchParams: { days?: string };
}

export const dynamic = 'force-dynamic';

export default async function DevicePage({ params, searchParams }: PageProps) {
  const deviceId = decodeURIComponent(params.id);
  const days = Math.min(Number(searchParams.days ?? '30'), 365);

  const manifest = await getFleetManifest();
  const record = manifest?.devices[deviceId];
  if (!record) notFound();

  const [motus, testDeployments] = await Promise.all([
    getDeviceLocation(deviceId),
    getDeviceTestDeployments(deviceId),
  ]);
  const hasValidLocation = !!motus && motus.latitude !== 0 && motus.longitude !== 0;

  // Anchor the day-range window on the device's last upload, not today — an
  // offline device's data can be well outside "the last N calendar days from
  // now", which otherwise always looked like it had nothing to show.
  const cutoff = new Date(record.lastSeen);
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const airDates = record.airDates.filter((d) => d >= cutoffStr).sort();
  const lightDates = record.lightDates.filter((d) => d >= cutoffStr).sort();

  const [airSummaries, lightSummaries] = await Promise.all([
    getAirSummaries(deviceId, airDates),
    getLightSummaries(deviceId, lightDates),
  ]);

  const latestAir: AirDailySummary | undefined = airSummaries[airSummaries.length - 1];
  const latestLight: LightDailySummary | undefined = lightSummaries[lightSummaries.length - 1];

  const dayOptions = [7, 14, 30, 90];

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Link href="/dashboard" className="hover:text-gray-900">Dashboard</Link>
          <span>/</span>
          <span className="text-gray-900 font-medium">{deviceId}</span>
        </div>

        {/* Device header */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {motus?.stationName ?? deviceId}
              </h2>
              <div className="mt-1 flex flex-wrap gap-4 text-sm text-gray-500">
                <span>ID: <code className="text-gray-800 text-xs bg-gray-100 px-1 rounded">{deviceId}</code></span>
                <span>Version: {record.version}</span>
                {hasValidLocation && motus && (
                  <span>
                    Location: {motus.latitude.toFixed(4)}, {motus.longitude.toFixed(4)}
                    {motus.isTestDeployment && (
                      <span className="ml-1 text-xs text-motus-secondary font-medium">(test deployment)</span>
                    )}
                  </span>
                )}
                <span>Last upload: {record.lastSeen}</span>
                <span>Since: {record.firstSeen}</span>
              </div>
            </div>
            {/* Day range selector */}
            <div className="flex gap-1">
              {dayOptions.map((d) => (
                <Link
                  key={d}
                  href={`/device/${encodeURIComponent(deviceId)}?days=${d}`}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                    days === d
                      ? 'bg-brand-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {d}d
                </Link>
              ))}
            </div>
          </div>
        </div>

        {(!hasValidLocation || testDeployments.length > 0) && (
          <TestDeploymentPanel
            deviceId={deviceId}
            initialDeployments={testDeployments}
            dataRange={{ firstSeen: record.firstSeen, lastSeen: record.lastSeen }}
          />
        )}

        {/* Summary cards */}
        <DeviceSummaryCards latestAir={latestAir ?? null} latestLight={latestLight ?? null} />

        {/* Air quality charts */}
        {airSummaries.length > 0 && (
          <section>
            <h3 className="text-base font-semibold text-gray-800 mb-3">Air Quality</h3>
            <AirCharts summaries={airSummaries} />
          </section>
        )}

        {/* Sky quality chart */}
        {lightSummaries.length > 0 && (
          <section>
            <h3 className="text-base font-semibold text-gray-800 mb-3">Sky Quality (SQM-LU)</h3>
            <LightChart summaries={lightSummaries} />
          </section>
        )}

        {airSummaries.length === 0 && lightSummaries.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
            <p>No summary data available for the selected range.</p>
            <p className="text-sm mt-1">
              Summaries are generated by the Lambda function when files are uploaded.
            </p>
          </div>
        )}

        {/* Downloads */}
        <section>
          <h3 className="text-base font-semibold text-gray-800 mb-3">Download Raw Data</h3>
          <DownloadPanel deviceId={deviceId} airDates={record.airDates} lightDates={record.lightDates} />
        </section>
      </main>
    </div>
  );
}
