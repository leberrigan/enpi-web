import type { MotusDevice } from '@/types';

const RECEIVERS_URL = 'https://motus.b-cdn.net/data/dashboard/receivers.json';
const DEPLOYMENTS_URL = 'https://motus.b-cdn.net/data/dashboard/stationDeployments.json';
const STATIONS_URL = 'https://motus.b-cdn.net/data/dashboard/stations.json';
// The dashboard feeds above are a curated mirror and don't cover every
// registered receiver. The official downloadable deployment history covers
// more of them (and carries lat/lon directly), so it's used as a second
// source rather than a one-off patch for any single serial number.
const OFFICIAL_DEPLOYMENTS_CSV_URL = 'https://motus.org/data/downloads/api-proxy/receivers/deployments?fmt=csv';

// Motus API responses wrap the array in a "results" key (occasionally "data")
function unwrapResults(json: unknown): unknown[] {
  if (Array.isArray(json)) return json;
  const obj = json as Record<string, unknown>;
  return (obj.results as unknown[] | undefined) ?? (obj.data as unknown[] | undefined) ?? [];
}

// Minimal quote-aware CSV line parser (fields can contain commas inside quotes)
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      out.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

function parseDeploymentsCsv(text: string): Record<string, unknown>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length === 0) return [];
  const header = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const fields = parseCsvLine(line);
    const row: Record<string, unknown> = {};
    header.forEach((h, i) => {
      row[h] = fields[i];
    });
    return row;
  });
}

interface LocationCandidate {
  active: boolean;
  tsStart: number;
  name: string;
  lat: number;
  lon: number;
}

function isBetterCandidate(candidate: LocationCandidate, current: LocationCandidate | undefined): boolean {
  return (
    !current ||
    (candidate.active && !current.active) ||
    (candidate.active === current.active && candidate.tsStart > current.tsStart)
  );
}

// Cache for 24 hours via Next.js fetch cache
async function fetchMotusReceivers(): Promise<Record<string, MotusDevice>> {
  const [receiversRes, deploymentsRes, stationsRes, officialCsvRes] = await Promise.all([
    fetch(RECEIVERS_URL, { next: { revalidate: 86400 } }),
    fetch(DEPLOYMENTS_URL, { next: { revalidate: 86400 } }),
    fetch(STATIONS_URL, { next: { revalidate: 86400 } }),
    fetch(OFFICIAL_DEPLOYMENTS_CSV_URL, { next: { revalidate: 86400 } }).catch(() => null),
  ]);

  if (!receiversRes.ok || !deploymentsRes.ok || !stationsRes.ok) {
    throw new Error('Failed to fetch Motus data');
  }

  const receiverList = unwrapResults(await receiversRes.json());
  const deploymentList = unwrapResults(await deploymentsRes.json());
  const stationList = unwrapResults(await stationsRes.json());
  // Best-effort: the official CSV export is a bonus data source, not required.
  const officialDeploymentRows =
    officialCsvRes && officialCsvRes.ok ? parseDeploymentsCsv(await officialCsvRes.text()) : [];

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

  // Collect every candidate location we can find for a serial number, from
  // either source, then pick the best one per serial (active first, then most
  // recent). This is the union of both feeds rather than a fallback chain, so
  // whichever source actually has data for a given receiver is used.
  const candidatesBySerial: Record<string, LocationCandidate[]> = {};
  const addCandidate = (serno: string, candidate: LocationCandidate) => {
    if (!(serno in candidatesBySerial)) candidatesBySerial[serno] = [];
    candidatesBySerial[serno].push(candidate);
  };

  for (const [serno, sensorIds] of Object.entries(sensorIdsBySerno)) {
    for (const sensorId of sensorIds) {
      const score = bestDeploymentBySensor[String(sensorId)];
      if (!score) continue;
      const stationId = stationIdBySensor[String(sensorId)];
      const station = stationId != null ? stationById[String(stationId)] : undefined;
      if (!station) continue;
      addCandidate(serno, { ...score, name: station.name, lat: station.lat, lon: station.lon });
    }
  }

  // The official deployment history export carries lat/lon directly and is
  // keyed by the receiver's serial number (receiverID), so it needs no join
  // through sensorID/stationID at all.
  for (const row of officialDeploymentRows) {
    const serno = String(row.receiverID ?? '');
    const lat = Number(row.latitude);
    const lon = Number(row.longitude);
    if (!serno || !Number.isFinite(lat) || !Number.isFinite(lon) || (lat === 0 && lon === 0)) continue;

    const tsEnd = row.tsEnd;
    const active = row.deploymentStatus === 'active' || tsEnd == null || tsEnd === '';
    const tsStart = Number(row.tsStart ?? 0);
    addCandidate(serno, { active, tsStart, name: String(row.siteName ?? row.deploymentName ?? ''), lat, lon });
  }

  const result: Record<string, MotusDevice> = {};
  for (const [serno, candidates] of Object.entries(candidatesBySerial)) {
    let best: LocationCandidate | undefined;
    for (const candidate of candidates) {
      if (isBetterCandidate(candidate, best)) best = candidate;
    }

    result[serno] = {
      serialNumber: serno,
      stationName: best?.name || serno,
      latitude: best?.lat ?? 0,
      longitude: best?.lon ?? 0,
    };
  }

  // Serials that only ever appear in receivers.json with no deployment
  // evidence anywhere still need an entry so the UI can show them (with no
  // coordinates) instead of silently dropping them.
  for (const serno of Object.keys(sensorIdsBySerno)) {
    if (!(serno in result)) {
      result[serno] = { serialNumber: serno, stationName: serno, latitude: 0, longitude: 0 };
    }
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
