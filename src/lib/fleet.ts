import type {
  AirDailySummary,
  DeviceRecord,
  DeviceStatus,
  FleetDevice,
  FleetManifest,
  LightDailySummary,
  MetricStats,
} from '@/types';
import { getAllMotusDevices } from './motus';
import { getAirSummary, getLightSummary } from './s3';

function getStatus(lastSeen: string): DeviceStatus {
  const daysSince = (Date.now() - new Date(lastSeen).getTime()) / 86_400_000;
  if (daysSince <= 2) return 'active';
  if (daysSince <= 7) return 'stale';
  return 'offline';
}

// The lambda writes a summary whenever a file has valid timestamps, even if
// every sensor column in it was "NA" (unparseable). Those summaries end up
// with every metric pinned at exactly 0 — real readings essentially never do
// that across every metric for a whole day, so it's a reliable "no data" tell.
function isZeroStats(s: MetricStats): boolean {
  return s.min === 0 && s.max === 0 && s.avg === 0;
}

function airSummaryHasData(summary: AirDailySummary | null): boolean {
  if (!summary) return false;
  const { temp, pressure, humidity, pm1, pm25, pm10 } = summary.daily;
  return ![temp, pressure, humidity, pm1, pm25, pm10].every(isZeroStats);
}

function lightSummaryHasData(summary: LightDailySummary | null): boolean {
  if (!summary) return false;
  const { lightLevel, sqmTemp } = summary.daily;
  return ![lightLevel, sqmTemp].every(isZeroStats);
}

async function deviceHasData(deviceId: string, record: DeviceRecord): Promise<boolean> {
  const latestAirDate = record.airDates[record.airDates.length - 1];
  const latestLightDate = record.lightDates[record.lightDates.length - 1];

  const [airSummary, lightSummary] = await Promise.all([
    latestAirDate ? getAirSummary(deviceId, latestAirDate) : Promise.resolve(null),
    latestLightDate ? getLightSummary(deviceId, latestLightDate) : Promise.resolve(null),
  ]);

  return airSummaryHasData(airSummary) || lightSummaryHasData(lightSummary);
}

export async function buildFleetDevices(manifest: FleetManifest): Promise<FleetDevice[]> {
  const motusDevices = await getAllMotusDevices();

  return Promise.all(
    Object.entries(manifest.devices).map(async ([deviceId, record]) => ({
      deviceId,
      record,
      motus: motusDevices[deviceId] ?? null,
      status: getStatus(record.lastSeen),
      hasData: await deviceHasData(deviceId, record),
    })),
  );
}
