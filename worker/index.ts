import { timingSafeEqual } from 'node:crypto';
import { dayBounds, validTelemetry } from '../shared/types';
import type { Reading } from '../shared/types';

type Row = Omit<Reading, 'pump_on' | 'pump_fault'> & { pump_on: number; pump_fault: number };
const reading = (row: Row): Reading => ({ ...row, pump_on: Boolean(row.pump_on), pump_fault: Boolean(row.pump_fault) });
const json = (data: unknown, status = 200) => Response.json(data, {
  status,
  headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
});

async function authorized(request: Request, token: string | undefined): Promise<boolean> {
  if (!token || token.length < 32) return false;
  const header = request.headers.get('Authorization') ?? '';
  if (!header.startsWith('Bearer ') || header.length > 512) return false;
  const encoder = new TextEncoder();
  const hashes = await Promise.all([header.slice(7), token].map(value =>
    crypto.subtle.digest('SHA-256', encoder.encode(value))));
  return timingSafeEqual(new Uint8Array(hashes[0]), new Uint8Array(hashes[1]));
}

async function boundedJson(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new Error('EMPTY_BODY');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 2048) { await reader.cancel(); throw new Error('BODY_TOO_LARGE'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder().decode(bytes));
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    try {
      if (url.pathname === '/api/latest' && request.method === 'GET') {
        const row = await env.DB.prepare('SELECT * FROM latest WHERE id = 1').first<Row>();
        return json({ reading: row ? reading(row) : null, online: !!row && Date.now() - row.recorded_at < 45_000 });
      }
      if (url.pathname === '/api/history' && request.method === 'GET') {
        const bounds = dayBounds(url.searchParams.get('date') ?? '');
        if (!bounds) return json({ error: 'Tanggal tidak valid. Gunakan YYYY-MM-DD.' }, 400);
        const [history, events] = await env.DB.batch([
          env.DB.prepare('SELECT * FROM readings WHERE recorded_at >= ? AND recorded_at < ? ORDER BY recorded_at LIMIT 1440').bind(...bounds),
          env.DB.prepare('SELECT * FROM pump_events WHERE recorded_at >= ? AND recorded_at < ? ORDER BY recorded_at LIMIT 5000').bind(...bounds),
        ]);
        return json({
          readings: (history.results as Row[]).map(reading),
          events: (events.results as { id: number; recorded_at: number; pump_on: number; soil_adc: number }[]).map(row => ({ ...row, pump_on: Boolean(row.pump_on) })),
        });
      }
      if (url.pathname === '/api/telemetry' && request.method === 'POST') {
        if (!env.DEVICE_TOKEN || env.DEVICE_TOKEN.length < 32) return json({ error: 'Token perangkat belum dikonfigurasi.' }, 503);
        if (!await authorized(request, env.DEVICE_TOKEN)) return json({ error: 'Token perangkat tidak valid.' }, 401);
        if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) return json({ error: 'Content-Type harus application/json.' }, 415);
        let body: unknown;
        try { body = await boundedJson(request); }
        catch (error) { return json({ error: 'Body JSON tidak valid atau melebihi 2 KB.' }, error instanceof Error && error.message === 'BODY_TOO_LARGE' ? 413 : 400); }
        if (!validTelemetry(body)) return json({ error: 'Nilai sensor atau status perangkat tidak valid.' }, 400);
        const now = Date.now();
        const values = [now, body.soil_adc, body.temperature, body.humidity, Number(body.pump_on), Number(body.pump_fault)];
        await env.DB.batch([
          env.DB.prepare(`INSERT INTO latest(id, recorded_at, soil_adc, temperature, humidity, pump_on, pump_fault, uptime_ms)
            VALUES(1, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET recorded_at=excluded.recorded_at, soil_adc=excluded.soil_adc,
            temperature=excluded.temperature, humidity=excluded.humidity, pump_on=excluded.pump_on,
            pump_fault=excluded.pump_fault, uptime_ms=excluded.uptime_ms
            WHERE excluded.recorded_at >= latest.recorded_at`).bind(...values, body.uptime_ms),
          env.DB.prepare(`INSERT OR IGNORE INTO readings(minute_bucket, recorded_at, soil_adc, temperature, humidity, pump_on, pump_fault)
            VALUES(?, ?, ?, ?, ?, ?, ?)`).bind(Math.floor(now / 60_000), ...values),
        ]);
        return json({ ok: true, recorded_at: now });
      }
      return json({ error: 'Endpoint tidak ditemukan.' }, 404);
    } catch (error) {
      console.error(JSON.stringify({ event: 'api_error', path: url.pathname, message: error instanceof Error ? error.message : 'Unknown error' }));
      return json({ error: 'Layanan data belum tersedia. Periksa konfigurasi database.' }, 503);
    }
  },
} satisfies ExportedHandler<Env & { DEVICE_TOKEN?: string }>;
