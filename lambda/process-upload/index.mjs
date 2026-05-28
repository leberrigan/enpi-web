/**
 * Lambda triggered by S3 PutObject events on the enpi-sensors bucket.
 * For each new CSV.GZ file:
 *  1. Parses the filename to extract device ID, sensor type, and date.
 *  2. Decompresses and parses the CSV.
 *  3. Computes daily stats (min/max/avg) and hourly averages.
 *  4. Writes a summary JSON to summaries/{deviceId}/{date}-{type}.json
 *  5. Updates the fleet-manifest.json with the device's date list.
 */

import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { createGunzip } from 'zlib';
import { Readable } from 'stream';

const s3 = new S3Client({});
const BUCKET = process.env.BUCKET_NAME ?? 'enpi-sensors';

// ─── Filename parsing ────────────────────────────────────────────────────────

function parseKey(key) {
  // key: SG-BC4ERPI3CF2A/air_SG-BC4ERPI3CF2A_v0.4.0_2026-05-17.csv.gz
  const parts = key.split('/');
  if (parts.length < 2) return null;

  const deviceId = parts[0];
  const filename = parts[parts.length - 1];

  // Match: {type}_{deviceId}_v{version}_{date}.csv.gz
  const match = filename.match(/^(air|light)_.+_v([\d.]+)_(\d{4}-\d{2}-\d{2})\.csv\.gz$/);
  if (!match) return null;

  return { deviceId, type: match[1], version: match[2], date: match[3], filename };
}

// ─── Stream helpers ──────────────────────────────────────────────────────────

async function decompressToString(s3Body) {
  const chunks = [];
  const gunzip = createGunzip();
  const readable = Readable.from(s3Body);
  readable.pipe(gunzip);
  for await (const chunk of gunzip) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf-8');
}

// ─── CSV parsing ─────────────────────────────────────────────────────────────

function parseNumber(s) {
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function parseAirRow(cols) {
  if (cols.length < 13) return null;
  const [ts, temp, pressure, humidity, pm1, pm25, pm10] = cols.map(parseNumber);
  if (ts == null) return null;
  return { ts, temp, pressure, humidity, pm1, pm25, pm10 };
}

function parseLightRow(cols) {
  if (cols.length < 6) return null;
  const [ts, lightLevel, , , , sqmTemp] = cols.map(parseNumber);
  if (ts == null) return null;
  return { ts, lightLevel, sqmTemp };
}

function parseCsv(text, type) {
  const rows = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const cols = trimmed.split(',');
    // Skip header if present (first col would not be numeric)
    if (isNaN(parseFloat(cols[0]))) continue;
    const row = type === 'air' ? parseAirRow(cols) : parseLightRow(cols);
    if (row) rows.push(row);
  }
  return rows;
}

// ─── Statistics ──────────────────────────────────────────────────────────────

function stats(values) {
  const valid = values.filter((v) => v != null && !isNaN(v));
  if (valid.length === 0) return { min: 0, max: 0, avg: 0 };
  const min = Math.min(...valid);
  const max = Math.max(...valid);
  const avg = Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 100) / 100;
  return { min, max, avg };
}

function computeAirSummary(deviceId, date, rows) {
  const hourlyBuckets = Array.from({ length: 24 }, () => ({
    temp: [], pressure: [], humidity: [], pm1: [], pm25: [], pm10: [],
  }));

  for (const row of rows) {
    const hour = new Date(row.ts * 1000).getUTCHours();
    const b = hourlyBuckets[hour];
    if (row.temp != null) b.temp.push(row.temp);
    if (row.pressure != null) b.pressure.push(row.pressure);
    if (row.humidity != null) b.humidity.push(row.humidity);
    if (row.pm1 != null) b.pm1.push(row.pm1);
    if (row.pm25 != null) b.pm25.push(row.pm25);
    if (row.pm10 != null) b.pm10.push(row.pm10);
  }

  const hourly = hourlyBuckets
    .map((b, hour) => {
      if (b.temp.length === 0) return null;
      return {
        hour,
        temp: Math.round((b.temp.reduce((a, v) => a + v, 0) / b.temp.length) * 100) / 100,
        pressure: Math.round((b.pressure.reduce((a, v) => a + v, 0) / b.pressure.length) * 100) / 100,
        humidity: Math.round((b.humidity.reduce((a, v) => a + v, 0) / b.humidity.length) * 100) / 100,
        pm1: Math.round((b.pm1.reduce((a, v) => a + v, 0) / b.pm1.length) * 10) / 10,
        pm25: Math.round((b.pm25.reduce((a, v) => a + v, 0) / b.pm25.length) * 10) / 10,
        pm10: Math.round((b.pm10.reduce((a, v) => a + v, 0) / b.pm10.length) * 10) / 10,
      };
    })
    .filter(Boolean);

  return {
    date,
    deviceId,
    type: 'air',
    count: rows.length,
    daily: {
      temp: stats(rows.map((r) => r.temp)),
      pressure: stats(rows.map((r) => r.pressure)),
      humidity: stats(rows.map((r) => r.humidity)),
      pm1: stats(rows.map((r) => r.pm1)),
      pm25: stats(rows.map((r) => r.pm25)),
      pm10: stats(rows.map((r) => r.pm10)),
    },
    hourly,
  };
}

function computeLightSummary(deviceId, date, rows) {
  const hourlyBuckets = Array.from({ length: 24 }, () => ({ lightLevel: [], sqmTemp: [] }));

  for (const row of rows) {
    const hour = new Date(row.ts * 1000).getUTCHours();
    const b = hourlyBuckets[hour];
    if (row.lightLevel != null) b.lightLevel.push(row.lightLevel);
    if (row.sqmTemp != null) b.sqmTemp.push(row.sqmTemp);
  }

  const hourly = hourlyBuckets
    .map((b, hour) => {
      if (b.lightLevel.length === 0) return null;
      return {
        hour,
        lightLevel: Math.round((b.lightLevel.reduce((a, v) => a + v, 0) / b.lightLevel.length) * 100) / 100,
        sqmTemp: Math.round((b.sqmTemp.reduce((a, v) => a + v, 0) / b.sqmTemp.length) * 100) / 100,
      };
    })
    .filter(Boolean);

  return {
    date,
    deviceId,
    type: 'light',
    count: rows.length,
    daily: {
      lightLevel: stats(rows.map((r) => r.lightLevel)),
      sqmTemp: stats(rows.map((r) => r.sqmTemp)),
      frequency: { min: 0, max: 0, avg: 0 }, // low priority metric
      duration: { min: 0, max: 0, avg: 0 },
    },
    hourly,
  };
}

// ─── S3 helpers ──────────────────────────────────────────────────────────────

async function getJson(key) {
  try {
    const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    const text = await res.Body.transformToString();
    return JSON.parse(text);
  } catch (e) {
    if (e.name === 'NoSuchKey') return null;
    throw e;
  }
}

async function putJson(key, obj) {
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: JSON.stringify(obj),
      ContentType: 'application/json',
    }),
  );
}

// ─── Manifest update ─────────────────────────────────────────────────────────

async function updateManifest(deviceId, type, date, version) {
  const manifest = (await getJson('fleet-manifest.json')) ?? { updatedAt: '', devices: {} };

  if (!manifest.devices[deviceId]) {
    manifest.devices[deviceId] = {
      firstSeen: date,
      lastSeen: date,
      airDates: [],
      lightDates: [],
      version,
    };
  }

  const rec = manifest.devices[deviceId];
  rec.version = version;
  if (date < rec.firstSeen) rec.firstSeen = date;
  if (date > rec.lastSeen) rec.lastSeen = date;

  const dateList = type === 'air' ? rec.airDates : rec.lightDates;
  if (!dateList.includes(date)) {
    dateList.push(date);
    dateList.sort();
  }

  manifest.updatedAt = new Date().toISOString();
  await putJson('fleet-manifest.json', manifest);
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export const handler = async (event) => {
  const results = [];

  for (const record of event.Records ?? []) {
    const key = decodeURIComponent(record.s3?.object?.key?.replace(/\+/g, ' ') ?? '');
    console.log('Processing:', key);

    const parsed = parseKey(key);
    if (!parsed) {
      console.log('Skipping unrecognised key:', key);
      continue;
    }

    const { deviceId, type, version, date } = parsed;

    try {
      // Download and decompress
      const s3Res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
      const text = await decompressToString(s3Res.Body);
      const rows = parseCsv(text, type);

      if (rows.length === 0) {
        console.warn('No parseable rows in', key);
        continue;
      }

      // Compute summary
      const summary =
        type === 'air'
          ? computeAirSummary(deviceId, date, rows)
          : computeLightSummary(deviceId, date, rows);

      // Write summary
      const summaryKey = `summaries/${deviceId}/${date}-${type}.json`;
      await putJson(summaryKey, summary);
      console.log('Wrote summary:', summaryKey);

      // Update manifest
      await updateManifest(deviceId, type, date, version);
      console.log('Manifest updated for', deviceId, type, date);

      results.push({ key, status: 'ok', rows: rows.length });
    } catch (err) {
      console.error('Failed to process', key, err);
      results.push({ key, status: 'error', error: String(err) });
    }
  }

  return { processed: results.length, results };
};
