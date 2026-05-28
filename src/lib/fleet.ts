import type { FleetDevice, DeviceStatus, FleetManifest } from '@/types';
import { getAllMotusDevices } from './motus';

function getStatus(lastSeen: string): DeviceStatus {
  const daysSince = (Date.now() - new Date(lastSeen).getTime()) / 86_400_000;
  if (daysSince <= 2) return 'active';
  if (daysSince <= 7) return 'stale';
  return 'offline';
}

export async function buildFleetDevices(manifest: FleetManifest): Promise<FleetDevice[]> {
  const motusDevices = await getAllMotusDevices();

  return Object.entries(manifest.devices).map(([deviceId, record]) => ({
    deviceId,
    record,
    motus: motusDevices[deviceId] ?? null,
    status: getStatus(record.lastSeen),
  }));
}
