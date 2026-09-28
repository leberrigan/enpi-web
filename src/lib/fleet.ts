import type {
  AirDailySummary,
  DeviceRecord,
  DeviceStatus,
  FleetDevice,
  FleetManifest,
  LightDailySummary,
  MetricStats,
  MotusDevice,
  TestDeployment,
} from '@/types';
import { getAllMotusDevices, isWithinWindow } from './motus';
import { getAirSummary, getLightSummary, getTestDeployments } from './s3';

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

function hasValidLocation(motus: MotusDevice | null): boolean {
  return !!motus && motus.latitude !== 0 && motus.longitude !== 0;
}

// Picks the test deployment whose window currently covers "now" (active
// preferred, then most recent tsStart) — same rule as a real Motus deployment.
function currentTestDeployment(deployments: TestDeployment[], now: number): TestDeployment | undefined {
  let best: TestDeployment | undefined;
  for (const d of deployments) {
    if (!isWithinWindow(d.tsStart, d.tsEnd, now)) continue;
    const active = d.tsEnd == null;
    const bestActive = best ? best.tsEnd == null : false;
    const isBetter = !best || (active && !bestActive) || (active === bestActive && d.tsStart > best.tsStart);
    if (isBetter) best = d;
  }
  return best;
}

// Test deployments only kick in when Motus has no current location for the
// device, and are flagged so the UI can render them differently.
function resolveLocation(
  deviceId: string,
  motusLocation: MotusDevice | null,
  testDeployments: TestDeployment[],
  now: number,
): MotusDevice | null {
  if (hasValidLocation(motusLocation)) return motusLocation;

  const testDeployment = currentTestDeployment(testDeployments, now);
  if (testDeployment) {
    return {
      serialNumber: deviceId,
      stationName: testDeployment.stationName,
      latitude: testDeployment.latitude,
      longitude: testDeployment.longitude,
      isTestDeployment: true,
    };
  }

  return motusLocation;
}

export async function buildFleetDevices(manifest: FleetManifest): Promise<FleetDevice[]> {
  const [motusDevices, testDeploymentsFile] = await Promise.all([getAllMotusDevices(), getTestDeployments()]);

  const testDeploymentsByDevice: Record<string, TestDeployment[]> = {};
  for (const d of testDeploymentsFile.deployments) {
    (testDeploymentsByDevice[d.deviceId] ??= []).push(d);
  }

  const now = Date.now() / 1000;

  return Promise.all(
    Object.entries(manifest.devices).map(async ([deviceId, record]) => ({
      deviceId,
      record,
      motus: resolveLocation(deviceId, motusDevices[deviceId] ?? null, testDeploymentsByDevice[deviceId] ?? [], now),
      status: getStatus(record.lastSeen),
      hasData: await deviceHasData(deviceId, record),
    })),
  );
}

export async function getDeviceLocation(deviceId: string): Promise<MotusDevice | null> {
  const [motusDevices, testDeploymentsFile] = await Promise.all([getAllMotusDevices(), getTestDeployments()]);
  const deviceTestDeployments = testDeploymentsFile.deployments.filter((d) => d.deviceId === deviceId);
  return resolveLocation(deviceId, motusDevices[deviceId] ?? null, deviceTestDeployments, Date.now() / 1000);
}

export async function getDeviceTestDeployments(deviceId: string): Promise<TestDeployment[]> {
  const file = await getTestDeployments();
  return file.deployments.filter((d) => d.deviceId === deviceId);
}
