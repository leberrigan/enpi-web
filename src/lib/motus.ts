import type { MotusDevice } from '@/types';

const RECEIVERS_URL = 'https://motus.b-cdn.net/data/dashboard/receivers.json';
const DEPLOYMENTS_URL = 'https://motus.b-cdn.net/data/dashboard/stationDeployments.json';
const STATIONS_URL = 'https://motus.b-cdn.net/data/dashboard/stations.json';

// Motus API responses wrap the array in a "results" key (occasionally "data")
function unwrapResults(json: unknown): unknown[] {
  if (Array.isArray(json)) return json;
  const obj = json as Record<string, unknown>;
  return (obj.results as unknown[] | undefined) ?? (obj.data as unknown[] | undefined) ?? [];
}

// Cache for 24 hours via Next.js fetch cache
async function fetchMotusReceivers(): Promise<Record<string, MotusDevice>> {
  const [receiversRes, deploymentsRes, stationsRes] = await Promise.all([
    fetch(RECEIVERS_URL, { next: { revalidate: 86400 } }),
    fetch(DEPLOYMENTS_URL, { next: { revalidate: 86400 } }),
    fetch(STATIONS_URL, { next: { revalidate: 86400 } }),
  ]);

  if (!receiversRes.ok || !deploymentsRes.ok || !stationsRes.ok) {
    throw new Error('Failed to fetch Motus data');
  }

  const receiverList = unwrapResults(await receiversRes.json());
  const deploymentList = unwrapResults(await deploymentsRes.json());
  const stationList = unwrapResults(await stationsRes.json());

  // Coordinates live on stations.json, keyed by stationID
  const stationById: Record<string, { name: string; lat: number; lon: number }> = {};
  for (const st of stationList) {
    const s = st as Record<string, unknown>;
    if (s.stationID == null) continue;
    stationById[String(s.stationID)] = {
      name: String(s.stationName ?? ''),
      lat: Number(s.latitude ?? 0),
      lon: Number(s.longitude ?? 0),
    };
  }

  // stationDeployments.json links a receiver (by sensorID) to a station over a
  // time range. A receiver can have several deployments over its lifetime, so
  // pick the currently-active one (tsEnd == null), falling back to the most
  // recent by tsStart.
  const stationIdBySensor: Record<string, number> = {};
  const bestDeploymentBySensor: Record<string, { active: boolean; tsStart: number }> = {};
  for (const dep of deploymentList) {
    const d = dep as Record<string, unknown>;
    const sensorId = d.sensorID;
    const stationId = d.stationID;
    if (sensorId == null || stationId == null) continue;

    const key = String(sensorId);
    const active = d.tsEnd == null;
    const tsStart = Number(d.tsStart ?? 0);
    const current = bestDeploymentBySensor[key];

    const isBetter =
      !current || (active && !current.active) || (active === current.active && tsStart > current.tsStart);

    if (isBetter) {
      bestDeploymentBySensor[key] = { active, tsStart };
      stationIdBySensor[key] = Number(stationId);
    }
  }

  // The same serial number can appear multiple times in receivers.json under
  // different sensorIDs (re-registrations, hardware swaps, test entries, etc).
  // Group them so we can pick whichever sensorID actually has deployment data,
  // instead of just keeping whichever happened to come last in the list.
  const sensorIdsBySerno: Record<string, number[]> = {};
  for (const rec of receiverList) {
    const r = rec as Record<string, unknown>;
    const serno = String(r.serno ?? r.serialNumber ?? r.receiverSerialNumber ?? '');
    if (!serno) continue;
    if (!(serno in sensorIdsBySerno)) sensorIdsBySerno[serno] = [];

    const sensorId = r.sensorID ?? r.sensorId;
    if (sensorId != null) sensorIdsBySerno[serno].push(Number(sensorId));
  }

  const result: Record<string, MotusDevice> = {};
  for (const [serno, sensorIds] of Object.entries(sensorIdsBySerno)) {
    let bestSensorId: number | undefined;
    let bestScore: { active: boolean; tsStart: number } | undefined;
    for (const sensorId of sensorIds) {
      const score = bestDeploymentBySensor[String(sensorId)];
      if (!score) continue;
      const isBetter =
        !bestScore || (score.active && !bestScore.active) || (score.active === bestScore.active && score.tsStart > bestScore.tsStart);
      if (isBetter) {
        bestScore = score;
        bestSensorId = sensorId;
      }
    }

    const stationId = bestSensorId != null ? stationIdBySensor[String(bestSensorId)] : undefined;
    const station = stationId != null ? stationById[String(stationId)] : undefined;

    result[serno] = {
      serialNumber: serno,
      stationName: station?.name || serno,
      latitude: station?.lat ?? 0,
      longitude: station?.lon ?? 0,
    };
  }

  return result;
}

let cachedDevices: Record<string, MotusDevice> | null = null;
let cacheExpiry = 0;

async function getMotusDevices(): Promise<Record<string, MotusDevice>> {
  if (cachedDevices && Date.now() < cacheExpiry) return cachedDevices;
  try {
    cachedDevices = await fetchMotusReceivers();
    cacheExpiry = Date.now() + 86_400_000; // 24h
    return cachedDevices;
  } catch {
    return cachedDevices ?? {};
  }
}

export async function getMotusDevice(serialNumber: string): Promise<MotusDevice | null> {
  const devices = await getMotusDevices();
  return devices[serialNumber] ?? null;
}

export async function getAllMotusDevices(): Promise<Record<string, MotusDevice>> {
  return getMotusDevices();
}
