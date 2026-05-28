import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { getFleetManifest } from '@/lib/s3';
import { buildFleetDevices } from '@/lib/fleet';

export async function GET() {
  const manifest = await getFleetManifest();
  if (!manifest) {
    return NextResponse.json({ devices: [] });
  }
  const devices = await buildFleetDevices(manifest);
  return NextResponse.json({ devices, updatedAt: manifest.updatedAt });
}
