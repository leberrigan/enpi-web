'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import type { TestDeployment } from '@/types';

const LocationPicker = dynamic(() => import('./LocationPicker'), {
  ssr: false,
  loading: () => <div className="h-60 bg-gray-100 rounded animate-pulse" />,
});

interface Props {
  deviceId: string;
  initialDeployments: TestDeployment[];
  /** Date range (YYYY-MM-DD) of this device's actual uploaded data, used to pre-populate the form. */
  dataRange: { firstSeen: string; lastSeen: string };
}

function dateToEpochSeconds(dateStr: string): number {
  return Math.floor(new Date(`${dateStr}T00:00:00Z`).getTime() / 1000);
}

async function parseJsonResponse(res: Response): Promise<any> {
  const text = await res.text();
  if (!text) {
    throw new Error(`Server returned an empty response (status ${res.status})`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Server returned an unexpected response (status ${res.status})`);
  }
}

export default function TestDeploymentPanel({ deviceId, initialDeployments, dataRange }: Props) {
  const [deployments, setDeployments] = useState(initialDeployments);
  const [stationName, setStationName] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [startDate, setStartDate] = useState(dataRange.firstSeen);
  const [endDate, setEndDate] = useState(dataRange.lastSeen);
  const [ongoing, setOngoing] = useState(false);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (latitude == null || longitude == null) {
      setError('Click the map to set a location');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/test-deployments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId,
          stationName: stationName || undefined,
          latitude,
          longitude,
          tsStart: dateToEpochSeconds(startDate),
          tsEnd: ongoing ? null : dateToEpochSeconds(endDate),
          notes: notes || undefined,
        }),
      });
      const data = await parseJsonResponse(res);
      if (!res.ok) throw new Error(data.error ?? 'Failed to add test deployment');
      setDeployments((prev) => [...prev, data.deployment]);
      setStationName('');
      setLatitude(null);
      setLongitude(null);
      setStartDate(dataRange.firstSeen);
      setEndDate(dataRange.lastSeen);
      setOngoing(false);
      setNotes('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add test deployment');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/test-deployments?id=${id}`, { method: 'DELETE' });
    if (res.ok) setDeployments((prev) => prev.filter((d) => d.id !== id));
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-700">Test Deployment Location</h3>
        <p className="text-xs text-gray-500 mt-1">
          This device has no current deployment in the public Motus database — likely a test
          deployment that Motus doesn&apos;t expose publicly. Add a manual location here so it
          still shows on the map; it&apos;ll be marked as a test location, not an official Motus
          deployment.
        </p>
      </div>

      {deployments.length > 0 && (
        <ul className="space-y-2">
          {deployments.map((d) => (
            <li
              key={d.id}
              className="flex items-center justify-between text-sm bg-gray-50 rounded px-3 py-2"
            >
              <div>
                <p className="font-medium text-gray-800">{d.stationName}</p>
                <p className="text-xs text-gray-500 font-mono">
                  {d.latitude.toFixed(4)}, {d.longitude.toFixed(4)}
                </p>
                <p className="text-xs text-gray-400">
                  {new Date(d.tsStart * 1000).toLocaleDateString()} –{' '}
                  {d.tsEnd == null ? (
                    <span className="text-green-600">Ongoing</span>
                  ) : (
                    new Date(d.tsEnd * 1000).toLocaleDateString()
                  )}
                </p>
              </div>
              <button
                onClick={() => handleDelete(d.id)}
                className="text-xs text-red-500 hover:underline"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          placeholder="Station / site name"
          value={stationName}
          onChange={(e) => setStationName(e.target.value)}
          className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
        />

        <div>
          <p className="text-xs text-gray-500 mb-1">Click the map to set the location</p>
          <LocationPicker
            latitude={latitude}
            longitude={longitude}
            onChange={(lat, lon) => {
              setLatitude(lat);
              setLongitude(lon);
            }}
          />
          <div className="grid grid-cols-2 gap-3 mt-2">
            <input
              type="number"
              step="any"
              placeholder="Latitude"
              value={latitude ?? ''}
              onChange={(e) => setLatitude(e.target.value === '' ? null : Number(e.target.value))}
              className="border border-gray-300 rounded px-2 py-1 text-sm"
              required
            />
            <input
              type="number"
              step="any"
              placeholder="Longitude"
              value={longitude ?? ''}
              onChange={(e) => setLongitude(e.target.value === '' ? null : Number(e.target.value))}
              className="border border-gray-300 rounded px-2 py-1 text-sm"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs text-gray-500">
            Start date
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="mt-1 w-full border border-gray-300 rounded px-2 py-1 text-sm text-gray-800"
              required
            />
          </label>
          <label className="text-xs text-gray-500">
            End date
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              disabled={ongoing}
              className="mt-1 w-full border border-gray-300 rounded px-2 py-1 text-sm text-gray-800 disabled:bg-gray-100 disabled:text-gray-400"
              required={!ongoing}
            />
          </label>
        </div>
        <label className="flex items-center gap-1.5 text-xs text-gray-600">
          <input type="checkbox" checked={ongoing} onChange={(e) => setOngoing(e.target.checked)} />
          Ongoing (no end date)
        </label>

        <input
          placeholder="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
        />
        {error && <p className="text-xs text-red-500">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-brand-600 text-white text-sm rounded py-1.5 disabled:opacity-50"
        >
          {submitting ? 'Adding…' : 'Add test deployment'}
        </button>
      </form>
    </div>
  );
}
