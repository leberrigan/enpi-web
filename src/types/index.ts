export interface MetricStats {
  min: number;
  max: number;
  avg: number;
}

export interface HourlyAirData {
  hour: number;
  temp: number;
  pressure: number;
  humidity: number;
  pm1: number;
  pm25: number;
  pm10: number;
}

export interface HourlyLightData {
  hour: number;
  lightLevel: number;
  sqmTemp: number;
}

export interface AirDailySummary {
  date: string;
  deviceId: string;
  type: 'air';
  count: number;
  daily: {
    temp: MetricStats;
    pressure: MetricStats;
    humidity: MetricStats;
    pm1: MetricStats;
    pm25: MetricStats;
    pm10: MetricStats;
  };
  hourly: HourlyAirData[];
}

export interface LightDailySummary {
  date: string;
  deviceId: string;
  type: 'light';
  count: number;
  daily: {
    lightLevel: MetricStats;
    sqmTemp: MetricStats;
    frequency: MetricStats;
    duration: MetricStats;
  };
  hourly: HourlyLightData[];
}

export type DailySummary = AirDailySummary | LightDailySummary;

export interface DeviceRecord {
  firstSeen: string;
  lastSeen: string;
  airDates: string[];
  lightDates: string[];
  version: string;
}

export interface FleetManifest {
  updatedAt: string;
  devices: Record<string, DeviceRecord>;
}

export interface MotusDevice {
  serialNumber: string;
  stationName: string;
  latitude: number;
  longitude: number;
  countryCode?: string;
}

export type DeviceStatus = 'active' | 'stale' | 'offline' | 'unknown';

export interface FleetDevice {
  deviceId: string;
  record: DeviceRecord;
  motus: MotusDevice | null;
  status: DeviceStatus;
  /** False when the device's most recent upload parsed but every sensor reading in it was NA. */
  hasData: boolean;
}
