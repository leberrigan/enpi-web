'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Area,
  AreaChart,
} from 'recharts';
import type { AirDailySummary } from '@/types';

interface Props {
  summaries: AirDailySummary[];
}

function fmt(date: string) {
  return date.slice(5); // "MM-DD"
}

export default function AirCharts({ summaries: raw }: Props) {
  const data = raw.map((s) => ({
    date: fmt(s.date),
    pm1Avg: s.daily.pm1.avg,
    pm25Avg: s.daily.pm25.avg,
    pm10Avg: s.daily.pm10.avg,
    pm25Min: s.daily.pm25.min,
    pm25Max: s.daily.pm25.max,
    tempAvg: s.daily.temp.avg,
    tempMin: s.daily.temp.min,
    tempMax: s.daily.temp.max,
    humAvg: s.daily.humidity.avg,
    humMin: s.daily.humidity.min,
    humMax: s.daily.humidity.max,
    pressAvg: s.daily.pressure.avg,
  }));

  const chartProps = {
    data,
    margin: { top: 4, right: 8, left: 0, bottom: 0 },
  };

  const axisProps = {
    tick: { fontSize: 11 },
    tickLine: false,
    axisLine: false,
  };

  const gridProps = {
    strokeDasharray: '3 3',
    stroke: '#f0f0f0',
  };

  return (
    <div className="space-y-4">
      {/* Particulate matter */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-xs font-semibold text-gray-600 mb-3 uppercase tracking-wide">
          Particulate Matter (µg/m³)
        </p>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart {...chartProps}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="date" {...axisProps} />
            <YAxis {...axisProps} width={35} />
            <Tooltip
              contentStyle={{ fontSize: 12, border: '1px solid #e5e7eb' }}
              labelStyle={{ fontWeight: 600 }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {/* PM2.5 shaded band */}
            <Area
              type="monotone"
              dataKey="pm25Max"
              stroke="none"
              fill="#bfdbfe"
              fillOpacity={0.4}
              name="PM2.5 range"
              legendType="none"
            />
            <Area
              type="monotone"
              dataKey="pm25Min"
              stroke="none"
              fill="#ffffff"
              fillOpacity={1}
              name=""
              legendType="none"
            />
            <Line type="monotone" dataKey="pm1Avg" stroke="#6366f1" name="PM1" dot={false} strokeWidth={1.5} />
            <Line type="monotone" dataKey="pm25Avg" stroke="#3b82f6" name="PM2.5" dot={false} strokeWidth={2} />
            <Line type="monotone" dataKey="pm10Avg" stroke="#0ea5e9" name="PM10" dot={false} strokeWidth={1.5} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Temperature & humidity */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-semibold text-gray-600 mb-3 uppercase tracking-wide">
            Temperature (°C)
          </p>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart {...chartProps}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="date" {...axisProps} />
              <YAxis {...axisProps} width={35} />
              <Tooltip contentStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="tempMax" stroke="none" fill="#fde68a" fillOpacity={0.4} legendType="none" name="" />
              <Area type="monotone" dataKey="tempMin" stroke="none" fill="#ffffff" fillOpacity={1} legendType="none" name="" />
              <Line type="monotone" dataKey="tempAvg" stroke="#f59e0b" name="Temp avg" dot={false} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-semibold text-gray-600 mb-3 uppercase tracking-wide">
            Humidity (%)
          </p>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart {...chartProps}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="date" {...axisProps} />
              <YAxis {...axisProps} width={35} domain={[0, 100]} />
              <Tooltip contentStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="humMax" stroke="none" fill="#bbf7d0" fillOpacity={0.4} legendType="none" name="" />
              <Area type="monotone" dataKey="humMin" stroke="none" fill="#ffffff" fillOpacity={1} legendType="none" name="" />
              <Line type="monotone" dataKey="humAvg" stroke="#10b981" name="Humidity avg" dot={false} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Pressure */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-xs font-semibold text-gray-600 mb-3 uppercase tracking-wide">
          Atmospheric Pressure (hPa)
        </p>
        <ResponsiveContainer width="100%" height={140}>
          <LineChart {...chartProps}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="date" {...axisProps} />
            <YAxis {...axisProps} width={45} domain={['auto', 'auto']} />
            <Tooltip contentStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="pressAvg" stroke="#8b5cf6" name="Pressure" dot={false} strokeWidth={1.5} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
