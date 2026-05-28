'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { LightDailySummary } from '@/types';

interface Props {
  summaries: LightDailySummary[];
}

function fmt(date: string) {
  return date.slice(5);
}

export default function LightChart({ summaries: raw }: Props) {
  const data = raw.map((s) => ({
    date: fmt(s.date),
    avg: s.daily.lightLevel.avg,
    min: s.daily.lightLevel.min,
    max: s.daily.lightLevel.max,
  }));

  // SQM magnitude: higher value = darker sky (less light pollution).
  // Invert Y axis so "better" (darker) is visually up.

  return (
    <div className="space-y-2">
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">
          Sky Brightness (mag/arcsec²) — higher is darker
        </p>
        <p className="text-xs text-gray-400 mb-3">
          Typical rural sky: ~21–22 | Suburban: ~18–19 | Urban: ~16–17
        </p>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={40}
              domain={['auto', 'auto']}
            />
            <Tooltip
              contentStyle={{ fontSize: 12, border: '1px solid #e5e7eb' }}
              formatter={(v: number) => [`${v.toFixed(2)} mag/arcsec²`]}
            />
            <Area type="monotone" dataKey="max" stroke="none" fill="#e0e7ff" fillOpacity={0.4} name="Range max" legendType="none" />
            <Area type="monotone" dataKey="min" stroke="none" fill="#ffffff" fillOpacity={1} name="" legendType="none" />
            <Area type="monotone" dataKey="avg" stroke="#6366f1" fill="#eef2ff" fillOpacity={0.6} name="Daily avg" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
