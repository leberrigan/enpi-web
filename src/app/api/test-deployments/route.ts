import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { COOKIE_NAME, verifySessionToken } from '@/lib/auth';
import { getTestDeployments, saveTestDeployments } from '@/lib/s3';
import type { TestDeployment } from '@/types';

export const dynamic = 'force-dynamic';

async function isAuthed(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  return !!token && verifySessionToken(token);
}

export async function GET() {
  const file = await getTestDeployments();
  return NextResponse.json(file);
}

interface CreateBody {
  deviceId?: string;
  stationName?: string;
  latitude?: number;
  longitude?: number;
  tsStart?: number;
  tsEnd?: number | null;
  notes?: string;
}

export async function POST(request: NextRequest) {
  if (!(await isAuthed(request))) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  let body: CreateBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const { deviceId, stationName, latitude, longitude } = body;
  if (
    !deviceId ||
    typeof latitude !== 'number' ||
    typeof longitude !== 'number' ||
    Number.isNaN(latitude) ||
    Number.isNaN(longitude)
  ) {
    return NextResponse.json({ error: 'deviceId, latitude and longitude are required' }, { status: 400 });
  }

  const deployment: TestDeployment = {
    id: randomUUID(),
    deviceId,
    stationName: stationName || deviceId,
    latitude,
    longitude,
    tsStart: typeof body.tsStart === 'number' ? body.tsStart : Math.floor(Date.now() / 1000),
    tsEnd: typeof body.tsEnd === 'number' ? body.tsEnd : null,
    notes: body.notes || undefined,
    createdAt: new Date().toISOString(),
  };

  const file = await getTestDeployments();
  file.deployments.push(deployment);
  await saveTestDeployments(file);

  return NextResponse.json({ ok: true, deployment });
}

export async function DELETE(request: NextRequest) {
  if (!(await isAuthed(request))) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'id param is required' }, { status: 400 });
  }

  const file = await getTestDeployments();
  const before = file.deployments.length;
  file.deployments = file.deployments.filter((d) => d.id !== id);
  if (file.deployments.length === before) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  await saveTestDeployments(file);

  return NextResponse.json({ ok: true });
}
