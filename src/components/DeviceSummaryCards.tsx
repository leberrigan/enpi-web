import type { AirDailySummary, LightDailySummary } from '@/types';

interface Props {
  latestAir: AirDailySummary | null;
  latestLight: LightDailySummary | null;
}

interface CardProps {
  label: string;
  value: string | number;
  unit?: string;
  sub?: string;
}

function Card({ label, value, unit, sub }: CardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">
        {value}
        {unit && <span className="text-sm font-normal text-gray-500 ml-1">{unit}</span>}
      </p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function DeviceSummaryCards({ latestAir, latestLight }: Props) {
  if (!latestAir && !latestLight) return null;

  return (
    <div>
      {latestAir && (
        <div>
          <p className="text-xs text-gray-400 mb-2">Latest air data — {latestAir.date}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            <Card
              label="PM2.5"
              value={latestAir.daily.pm25.avg.toFixed(1)}
              unit="µg/m³"
              sub={`${latestAir.daily.pm25.min}–${latestAir.daily.pm25.max}`}
            />
            <Card
              label="PM10"
              value={latestAir.daily.pm10.avg.toFixed(1)}
              unit="µg/m³"
              sub={`${latestAir.daily.pm10.min}–${latestAir.daily.pm10.max}`}
            />
            <Card
              label="Temperature"
              value={latestAir.daily.temp.avg.toFixed(1)}
              unit="°C"
              sub={`${latestAir.daily.temp.min}–${latestAir.daily.temp.max}`}
            />
            <Card
              label="Humidity"
              value={latestAir.daily.humidity.avg.toFixed(1)}
              unit="%"
              sub={`${latestAir.daily.humidity.min}–${latestAir.daily.humidity.max}`}
            />
            <Card
              label="Pressure"
              value={latestAir.daily.pressure.avg.toFixed(0)}
              unit="hPa"
              sub={`${latestAir.daily.pressure.min}–${latestAir.daily.pressure.max}`}
            />
            <Card
              label="Readings"
              value={latestAir.count}
              sub="that day"
            />
          </div>
        </div>
      )}

      {latestLight && (
        <div className="mt-4">
          <p className="text-xs text-gray-400 mb-2">Latest sky quality — {latestLight.date}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card
              label="Sky Brightness"
              value={latestLight.daily.lightLevel.avg.toFixed(2)}
              unit="mag/arcsec²"
              sub={`${latestLight.daily.lightLevel.min.toFixed(2)}–${latestLight.daily.lightLevel.max.toFixed(2)}`}
            />
            <Card
              label="SQM Temp"
              value={latestLight.daily.sqmTemp.avg.toFixed(1)}
              unit="°C"
            />
            <Card
              label="Readings"
              value={latestLight.count}
              sub="that day"
            />
          </div>
        </div>
      )}
    </div>
  );
}
