import {
  S3Client,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { FleetManifest, AirDailySummary, LightDailySummary, TestDeploymentsFile } from '@/types';

function createClient(): S3Client {
  return new S3Client({
    region: process.env.AWS_REGION ?? 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });
}

const BUCKET = process.env.S3_BUCKET_NAME ?? 'enpi-sensors';

async function getJsonObject<T>(key: string): Promise<T | null> {
  const client = createClient();
  try {
    const response = await client.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    const text = await response.Body!.transformToString();
    return JSON.parse(text) as T;
  } catch (e: unknown) {
    if ((e as { name?: string }).name === 'NoSuchKey') return null;
    throw e;
  }
}

export async function getFleetManifest(): Promise<FleetManifest | null> {
  return getJsonObject<FleetManifest>('fleet-manifest.json');
}

const TEST_DEPLOYMENTS_KEY = 'test-deployments.json';

export async function getTestDeployments(): Promise<TestDeploymentsFile> {
  const file = await getJsonObject<TestDeploymentsFile>(TEST_DEPLOYMENTS_KEY);
  return file ?? { deployments: [] };
}

export async function saveTestDeployments(file: TestDeploymentsFile): Promise<void> {
  const client = createClient();
  await client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: TEST_DEPLOYMENTS_KEY,
      Body: JSON.stringify(file),
      ContentType: 'application/json',
    }),
  );
}

export async function getAirSummary(
  deviceId: string,
  date: string,
): Promise<AirDailySummary | null> {
  return getJsonObject<AirDailySummary>(`summaries/${deviceId}/${date}-air.json`);
}

export async function getLightSummary(
  deviceId: string,
  date: string,
): Promise<LightDailySummary | null> {
  return getJsonObject<LightDailySummary>(`summaries/${deviceId}/${date}-light.json`);
}

export async function getAirSummaries(
  deviceId: string,
  dates: string[],
): Promise<AirDailySummary[]> {
  const results = await Promise.all(dates.map((d) => getAirSummary(deviceId, d)));
  return results.filter((r): r is AirDailySummary => r !== null);
}

export async function getLightSummaries(
  deviceId: string,
  dates: string[],
): Promise<LightDailySummary[]> {
  const results = await Promise.all(dates.map((d) => getLightSummary(deviceId, d)));
  return results.filter((r): r is LightDailySummary => r !== null);
}

export async function listDeviceRawFiles(deviceId: string): Promise<string[]> {
  const client = createClient();
  const response = await client.send(
    new ListObjectsV2Command({ Bucket: BUCKET, Prefix: `${deviceId}/` }),
  );
  return (
    response.Contents?.map((obj) => obj.Key!)
      .filter((k) => k.endsWith('.csv.gz'))
      .sort() ?? []
  );
}

export async function getPresignedDownloadUrl(
  s3Key: string,
  downloadFilename: string,
): Promise<string> {
  const client = createClient();
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: s3Key,
    ResponseContentDisposition: `attachment; filename="${downloadFilename}"`,
  });
  return getSignedUrl(client, command, { expiresIn: 3600 });
}
