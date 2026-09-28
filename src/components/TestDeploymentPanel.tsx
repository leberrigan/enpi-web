'use client';

import { useState } from 'react';
import type { TestDeployment } from '@/types';

interface Props {
  deviceId: string;
  initialDeployments: TestDeployment[];
}

export default function TestDeploymentPanel({ deviceId, initialDeployments }: Props) {
  const [deployments, setDeployments] = useState(initialDeployments);
  const [stationName, setStationName] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/test-deployments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId,
          stationName: stationName || undefined,
          latitude: Number(latitude),
          longitude: Number(longitude),
          notes: notes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to add test deployment');
      setDeployments((prev) => [...prev, data.deployment]);
      setStationName('');
      setLatitude('');
      setLongitude('');
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
                {d.tsEnd == null ? (
                  <p className="text-xs text-green-600">Ongoing</p>
                ) : (
                  <p className="text-xs text-gray-400">
                    Ended {new Date(d.tsEnd * 1000).toLocaleDateString()}
                  </p>
                )}
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

      <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3">
        <input
          placeholder="Station / site name"
          value={stationName}
          onChange={(e) => setStationName(e.target.value)}
          className="col-span-2 border border-gray-300 rounded px-2 py-1 text-sm"
        />
        <input
          placeholder="Latitude"
          value={latitude}
          onChange={(e) => setLatitude(e.target.value)}
          className="border border-gray-300 rounded px-2 py-1 text-sm"
          required
        />
        <input
          placeholder="Longitude"
          value={longitude}
          onChange={(e) => setLongitude(e.target.value)}
          className="border border-gray-300 rounded px-2 py-1 text-sm"
          required
        />
        <input
          placeholder="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="col-span-2 border border-gray-300 rounded px-2 py-1 text-sm"
        />
        {error && <p className="col-span-2 text-xs text-red-500">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="col-span-2 bg-brand-600 text-white text-sm rounded py-1.5 disabled:opacity-50"
        >
          {submitting ? 'Adding…' : 'Add test deployment'}
        </button>
      </form>
    </div>
  );
}
