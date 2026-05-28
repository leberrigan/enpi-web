import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { getFleetManifest, getAirSummaries, getLightSummaries } from '@/lib/s3';

interface Params {
  params: { id: string };
}

export async function GET(request: NextRequest, { params }: Params) {
  const deviceId = params.id;
  const searchParams = request.nextUrl.searchParams;
  const days = Math.min(Number(searchParams.get('days') ?? '30'), 365);
  const type = searchParams.get('type') as 'air' | 'light' | null;

  const manifest = await getFleetManifest();
  const record = manifest?.devices[deviceId];
  if (!record) {
    return NextResponse.json({ error: 'Device not found' }, { status: 404 });
  }

  // Select the most recent N dates
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const filterDates = (dates: string[]) =>
    dates.filter((d) => d >= cutoffStr).sort();

  const results: Record<string, unknown> = {};

  if (!type || type === 'air') {
    const airDates = filterDates(record.airDates);
    results.air = await getAirSummaries(deviceId, airDates);
  }
  if (!type || type === 'light') {
    const lightDates = filterDates(record.lightDates);
    results.light = await getLightSummaries(deviceId, lightDates);
  }

  return NextResponse.json(results);
}
