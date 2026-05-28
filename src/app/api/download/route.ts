import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { getPresignedDownloadUrl, listDeviceRawFiles } from '@/lib/s3';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const key = searchParams.get('key');
  const deviceId = searchParams.get('device');

  // Single file download
  if (key) {
    const filename = key.split('/').pop() ?? 'download.csv.gz';
    const url = await getPresignedDownloadUrl(key, filename);
    return NextResponse.redirect(url);
  }

  // List all files for a device (returns JSON with presigned URLs)
  if (deviceId) {
    const keys = await listDeviceRawFiles(deviceId);
    const urls = await Promise.all(
      keys.map(async (k) => ({
        key: k,
        filename: k.split('/').pop()!,
        url: await getPresignedDownloadUrl(k, k.split('/').pop()!),
      })),
    );
    return NextResponse.json({ files: urls });
  }

  return NextResponse.json({ error: 'Provide key or device param' }, { status: 400 });
}
