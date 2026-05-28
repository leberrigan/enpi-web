import type { MotusDevice } from '@/types';

const RECEIVERS_URL = 'https://motus.b-cdn.net/data/dashboard/receivers.json';
const DEPLOYMENTS_URL = 'https://motus.b-cdn.net/data/dashboard/stationDeployments.json';

// Cache for 24 hours via Next.js fetch cache
async function fetchMotusReceivers(): Promise<Record<string, MotusDevice>> {
  const [receiversRes, deploymentsRes] = await Promise.all([
    fetch(RECEIVERS_URL, { next: { revalidate: 86400 } }),
    fetch(DEPLOYMENTS_URL, { next: { revalidate: 86400 } }),
  ]);

  if (!receiversRes.ok || !deploymentsRes.ok) {
    throw new Error('Failed to fetch Motus data');
  }

  const receivers = await receiversRes.json();
  const deployments = await deploymentsRes.json();

  // Motus API returns arrays inside a "data" key; handle both formats
  const receiverList: unknown[] = Array.isArray(receivers) ? receivers : (receivers.data ?? []);
  const deploymentList: unknown[] = Array.isArray(deployments) ? deployments : (deployments.data ?? []);

  // Build a lookup: serialNumber → station info from deployments
  // stationDeployments links receivers to stations with lat/lon
  const deploymentByStn: Record<string | number, { name: string; lat: number; lon: number; country?: string }> = {};
  for (const dep of deploymentList) {
    const d = dep as Record<string, unknown>;
    const stnId = d.stationID ?? d.id;
    if (stnId != null) {
      deploymentByStn[String(stnId)] = {
        name: String(d.stationName ?? d.name ?? ''),
        lat: Number(d.latitude ?? d.lat ?? 0),
        lon: Number(d.longitude ?? d.lon ?? 0),
        country: d.countryCode != null ? String(d.countryCode) : undefined,
      };
    }
  }

  const result: Record<string, MotusDevice> = {};
  for (const rec of receiverList) {
    const r = rec as Record<string, unknown>;
    const serno = String(r.serno ?? r.serialNumber ?? r.receiverSerialNumber ?? '');
    if (!serno) continue;

    const stnId = r.stationID ?? r.id;
    const stn = stnId != null ? deploymentByStn[String(stnId)] : undefined;

    // Some receivers include lat/lon directly
    const lat = Number(r.latitude ?? r.lat ?? stn?.lat ?? 0);
    const lon = Number(r.longitude ?? r.lon ?? stn?.lon ?? 0);

    result[serno] = {
      serialNumber: serno,
      stationName: String(r.stationName ?? stn?.name ?? serno),
      latitude: lat,
      longitude: lon,
      countryCode: stn?.country,
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
