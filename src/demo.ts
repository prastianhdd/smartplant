import { dayBounds } from '../shared/types.ts';
import type { HistoryResponse, Reading } from '../shared/types';

// Data simulasi deterministik; tidak pernah dikirim ke database.
export function demoHistory(date: string): HistoryResponse {
  const bounds = dayBounds(date);
  if (!bounds) return { readings: [], events: [] };
  const end = Math.min(bounds[1] - 1, Date.now());
  const readings: Reading[] = [];
  const events: HistoryResponse['events'] = [];
  let previous = false;
  for (let time = bounds[0], i = 0; time <= end; time += 60_000, i++) {
    const cycle = (i + 130) % 240;
    const pump = cycle >= 222 && cycle < 224;
    const soil = cycle < 222 ? 2580 + cycle * 2.8 + Math.sin(i * .25) * 16 : cycle === 222 ? 3225 : 2690;
    const item: Reading = {
      id: i + 1, recorded_at: time, soil_adc: Math.round(soil),
      temperature: +(27 + Math.sin((i / 1440 * 2 - .6) * Math.PI) * 2.1).toFixed(1),
      humidity: +(73 - Math.sin((i / 1440 * 2 - .6) * Math.PI) * 7).toFixed(1),
      pump_on: pump, pump_fault: false,
    };
    readings.push(item);
    if (pump !== previous) events.push({ id: events.length + 1, recorded_at: time, pump_on: pump, soil_adc: item.soil_adc });
    previous = pump;
  }
  return { readings, events };
}
