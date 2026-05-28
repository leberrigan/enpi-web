import { NextResponse } from 'next/server';
import { S3Client, ListObjectsV2Command, PutObjectCommand } from '@aws-sdk/client-s3';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import type { FleetManifest, DeviceRecord } from '@/types';

export const dynamic = 'force-dynamic';

const BUCKET = process.env.S3_BUCKET_NAME ?? 'enpi-sensors';
const FILE_RE = /^(air|light)_.+_v([\d.]+)_(\d{4}-\d{2}-\d{2})\.csv\.gz$/;

function makeClients() {
  const credentials = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  };
  const region = process.env.AWS_REGION ?? 'us-east-1';
  return {
    s3: new S3Client({ region, credentials }),
    lambda: new LambdaClient({ region, credentials }),
  };
}

async function invokeLambda(
  lambda: LambdaClient,
  functionName: string,
  key: string,
): Promise<void> {
  const payload = {
    Records: [{ s3: { bucket: { name: BUCKET }, object: { key } } }],
  };
  await lambda.send(
    new InvokeCommand({
      FunctionName: functionName,
      InvocationType: 'Event', // async — returns immediately, Lambda runs in background
      Payload: JSON.stringify(payload),
    }),
  );
}

export async function POST() {
  const missing = [
    !process.env.AWS_ACCESS_KEY_ID && 'AWS_ACCESS_KEY_ID',
    !process.env.AWS_SECRET_ACCESS_KEY && 'AWS_SECRET_ACCESS_KEY',
  ].filter(Boolean);
  if (missing.length) {
    return NextResponse.json(
      { error: `Missing env vars: ${missing.join(', ')}` },
      { status: 500 },
    );
  }

  const lambdaFunctionName = process.env.LAMBDA_FUNCTION_NAME;

  try {
    const { s3, lambda } = makeClients();
    const devices: Record<string, DeviceRecord> = {};
    const csvKeys: string[] = [];

    // ── Scan S3 for all CSV.GZ files ─────────────────────────────────────────
    let continuationToken: string | undefined;
    do {
      const res = await s3.send(
        new ListObjectsV2Command({ Bucket: BUCKET, ContinuationToken: continuationToken }),
      );

      for (const obj of res.Contents ?? []) {
        const key = obj.Key ?? '';
        const parts = key.split('/');
        if (parts.length < 2) continue;

        const deviceId = parts[0];
        const filename = parts[parts.length - 1];
        const match = filename.match(FILE_RE);
        if (!match) continue;

        const [, type, version, date] = match;
        csvKeys.push(key);

        if (!devices[deviceId]) {
          devices[deviceId] = { firstSeen: date, lastSeen: date, airDates: [], lightDates: [], version };
        }
        const rec = devices[deviceId];
        rec.version = version;
        if (date < rec.firstSeen) rec.firstSeen = date;
        if (date > rec.lastSeen) rec.lastSeen = date;
        const dateList = type === 'air' ? rec.airDates : rec.lightDates;
        if (!dateList.includes(date)) dateList.push(date);
      }

      continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
    } while (continuationToken);

    for (const rec of Object.values(devices)) {
      rec.airDates.sort();
      rec.lightDates.sort();
    }

    // ── Write fleet manifest ──────────────────────────────────────────────────
    const manifest: FleetManifest = {
      updatedAt: new Date().toISOString(),
      devices,
    };
    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: 'fleet-manifest.json',
        Body: JSON.stringify(manifest),
        ContentType: 'application/json',
      }),
    );

    // ── Trigger Lambda for each file (if configured) ──────────────────────────
    let lambdaTriggered = 0;
    let lambdaSkipped = 0;

    if (lambdaFunctionName && csvKeys.length > 0) {
      // Fire in batches of 20 concurrent invocations
      const BATCH = 20;
      for (let i = 0; i < csvKeys.length; i += BATCH) {
        const batch = csvKeys.slice(i, i + BATCH);
        await Promise.all(batch.map((key) => invokeLambda(lambda, lambdaFunctionName, key)));
        lambdaTriggered += batch.length;
      }
    } else {
      lambdaSkipped = csvKeys.length;
    }

    return NextResponse.json({
      ok: true,
      devices: Object.keys(devices).length,
      filesScanned: csvKeys.length,
      lambdaTriggered,
      lambdaSkipped,
      lambdaConfigured: !!lambdaFunctionName,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
