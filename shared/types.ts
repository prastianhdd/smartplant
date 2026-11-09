export interface Reading {
  id: number;
  recorded_at: number;
  soil_adc: number;
  temperature: number | null;
  humidity: number | null;
  pump_on: boolean;
  pump_fault: boolean;
}

export interface PumpEvent {
  id: number;
  recorded_at: number;
  pump_on: boolean;
  soil_adc: number;
}

export interface Telemetry {
  soil_adc: number;
  temperature: number | null;
  humidity: number | null;
  pump_on: boolean;
  pump_fault: boolean;
  uptime_ms: number;
}

export interface LatestResponse { reading: Reading | null; online: boolean }
export interface HistoryResponse { readings: Reading[]; events: PumpEvent[] }

export function soilState(adc: number): 'Kering' | 'Lembap' | 'Basah' {
  return adc >= 3200 ? 'Kering' : adc <= 2700 ? 'Basah' : 'Lembap';
}

export function wibDate(timestamp = Date.now()): string {
  return new Date(timestamp + 7 * 3_600_000).toISOString().slice(0, 10);
}

export function dayBounds(date: string): [number, number] | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const start = Date.parse(`${date}T00:00:00+07:00`);
  if (!Number.isFinite(start) || wibDate(start) !== date) return null;
  return [start, start + 86_400_000];
}

export function validTelemetry(value: unknown): value is Telemetry {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  const range = (n: unknown, min: number, max: number) =>
    typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;
  return range(v.soil_adc, 0, 4095) && Number.isInteger(v.soil_adc)
    && (v.temperature === null || range(v.temperature, -40, 80))
    && (v.humidity === null || range(v.humidity, 0, 100))
    && typeof v.pump_on === 'boolean' && typeof v.pump_fault === 'boolean'
    && !(v.pump_fault && v.pump_on)
    && range(v.uptime_ms, 0, Number.MAX_SAFE_INTEGER) && Number.isInteger(v.uptime_ms);
}
