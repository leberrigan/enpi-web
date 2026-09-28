'use client';

import { useMemo, useState } from 'react';
import FleetMap from './FleetMap';
import FleetTable from './FleetTable';
import type { FleetDevice } from '@/types';

interface Props {
  devices: FleetDevice[];
}

export default function FleetOverview({ devices }: Props) {
  const [onlyWithData, setOnlyWithData] = useState(true);

  const withDataCount = devices.filter((d) => d.hasData).length;

  const visibleDevices = useMemo(
    () => (onlyWithData ? devices.filter((d) => d.hasData) : devices),
    [devices, onlyWithData],
  );

  const mappableDevices = useMemo(
    () => visibleDevices.filter((d) => d.motus && d.motus.latitude !== 0 && d.motus.longitude !== 0),
    [visibleDevices],
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end">
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={onlyWithData}
            onChange={(e) => setOnlyWithData(e.target.checked)}
            className="rounded border-gray-300"
          />
          Only show stations with data ({withDataCount}/{devices.length})
        </label>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 space-y-2">
          <FleetMap devices={mappableDevices} />
          {mappableDevices.length === 0 && visibleDevices.length > 0 && (
            <p className="text-xs text-amber-600 px-1">
              No devices found in the Motus database with valid coordinates — map is empty.
              Devices are listed in the table on the right. If your receivers are registered
              in Motus, their serial numbers (e.g. <code>SG-BC4ERPI3CF2A</code>) must match
              the <code>serno</code> field in the Motus receiver list.
            </p>
          )}
          {mappableDevices.length > 0 && mappableDevices.length < visibleDevices.length && (
            <p className="text-xs text-amber-600 px-1">
              {visibleDevices.length - mappableDevices.length} device(s) not shown on map — no Motus
              coordinates found.
            </p>
          )}
        </div>
        <div className="lg:col-span-2">
          <FleetTable devices={visibleDevices} />
        </div>
      </div>
    </div>
  );
}
