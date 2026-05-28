'use client';

import { useState } from 'react';

interface Props {
  deviceId: string;
  airDates: string[];
  lightDates: string[];
}

interface DownloadFile {
  key: string;
  filename: string;
  url: string;
}

function buildS3Key(deviceId: string, filename: string): string {
  // Files in S3 don't have the "uploaded_" prefix that's added locally on device
  // Raw S3 key is: {deviceId}/{filename without uploaded_ prefix}
  const name = filename.replace(/^uploaded_/, '');
  return `${deviceId}/${name}`;
}

function filenameFromParts(type: 'air' | 'light', deviceId: string, version: string, date: string): string {
  return `${type}_${deviceId}_${version}_${date}.csv.gz`;
}

export default function DownloadPanel({ deviceId, airDates, lightDates }: Props) {
  const [tab, setTab] = useState<'air' | 'light'>('air');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const dates = tab === 'air' ? airDates : lightDates;
  const sortedDates = [...dates].sort((a, b) => b.localeCompare(a));

  function toggleDate(date: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(sortedDates));
  }

  function clearAll() {
    setSelected(new Set());
  }

  async function downloadSelected() {
    if (selected.size === 0) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/download?device=${encodeURIComponent(deviceId)}`);
      const { files }: { files: DownloadFile[] } = await res.json();

      // Filter to selected dates
      const toDownload = files.filter((f) => {
        const match = f.filename.match(/(\d{4}-\d{2}-\d{2})\.csv\.gz$/);
        if (!match) return false;
        const fileDate = match[1];
        // Also match by type
        const isRightType = f.filename.startsWith(tab + '_') || f.filename.startsWith(`${tab}_`);
        return selected.has(fileDate) && isRightType;
      });

      // Trigger downloads sequentially
      for (const file of toDownload) {
        const a = document.createElement('a');
        a.href = file.url;
        a.download = file.filename;
        a.click();
        await new Promise((r) => setTimeout(r, 300));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
      {/* Tabs */}
      <div className="flex gap-2">
        {(['air', 'light'] as const).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setSelected(new Set()); }}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              tab === t ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {t === 'air' ? 'Air Quality' : 'Sky Quality'} ({(t === 'air' ? airDates : lightDates).length} files)
          </button>
        ))}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        <button onClick={selectAll} className="text-xs text-brand-600 hover:underline">Select all</button>
        <button onClick={clearAll} className="text-xs text-gray-500 hover:underline">Clear</button>
        <span className="text-xs text-gray-400">{selected.size} selected</span>
        <div className="flex-1" />
        <button
          onClick={downloadSelected}
          disabled={selected.size === 0 || loading}
          className="px-4 py-1.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white text-sm rounded font-medium transition-colors"
        >
          {loading ? 'Preparing...' : `Download ${selected.size > 0 ? selected.size : ''} file${selected.size !== 1 ? 's' : ''}`}
        </button>
      </div>

      {/* File list */}
      {sortedDates.length === 0 ? (
        <p className="text-sm text-gray-400">No {tab} data files available.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-1.5 max-h-64 overflow-y-auto">
          {sortedDates.map((date) => (
            <label
              key={date}
              className={`flex items-center gap-1.5 px-2 py-1.5 rounded border cursor-pointer text-xs transition-colors ${
                selected.has(date)
                  ? 'border-brand-500 bg-brand-50 text-brand-700'
                  : 'border-gray-200 hover:border-gray-300 text-gray-600'
              }`}
            >
              <input
                type="checkbox"
                checked={selected.has(date)}
                onChange={() => toggleDate(date)}
                className="accent-brand-600"
              />
              {date}
            </label>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-400">
        Files are gzipped CSV. Download links expire after 1 hour.
      </p>
    </div>
  );
}
