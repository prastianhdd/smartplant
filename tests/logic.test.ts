import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { dayBounds, wibDate, validTelemetry, soilState } from '../shared/types.ts';
import { demoHistory } from '../src/demo.ts';

test('batas hari WIB dan validasi tanggal kalender', () => {
  const bounds = dayBounds('2026-10-31')!;
  assert.equal(new Date(bounds[0]).toISOString(), '2026-10-30T17:00:00.000Z');
  assert.equal(bounds[1] - bounds[0], 86_400_000);
  assert.equal(wibDate(bounds[0]), '2026-10-31');
  assert.equal(dayBounds('2026-02-30'), null);
  assert.equal(dayBounds('31/10/26'), null);
});

test('validasi sensor menolak nilai rusak dan kondisi pompa tidak aman', () => {
  const valid = { soil_adc: 3200, temperature: 27, humidity: 70, pump_on: true, pump_fault: false, uptime_ms: 12345 };
  assert.ok(validTelemetry(valid));
  assert.ok(validTelemetry({ ...valid, temperature: null, humidity: null }));
  for (const invalid of [{ soil_adc: 4096 }, { soil_adc: 2.5 }, { soil_adc: '3200' }, { temperature: NaN }, { humidity: 101 }, { pump_on: 1 }, { pump_fault: true }, { uptime_ms: -1 }]) {
    assert.equal(validTelemetry({ ...valid, ...invalid }), false);
  }
  assert.equal(soilState(3200), 'Kering');
  assert.equal(soilState(2700), 'Basah');
  assert.equal(soilState(3000), 'Lembap');
});

test('trigger SQL hanya merekam perubahan pompa', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../migrations/0001_initial.sql', import.meta.url), 'utf8'));
  db.exec('INSERT INTO latest VALUES(1,1000,3300,27,70,0,0,0)');
  db.exec('UPDATE latest SET pump_on=1, recorded_at=2000');
  db.exec('UPDATE latest SET pump_on=1, recorded_at=3000');
  db.exec('UPDATE latest SET pump_on=0, recorded_at=4000');
  const events = db.prepare('SELECT * FROM pump_events ORDER BY recorded_at').all();
  assert.equal(events.length, 2);
  assert.equal(events[0].pump_on, 1);
  assert.equal(events[1].pump_on, 0);
  db.exec('INSERT INTO readings(minute_bucket,recorded_at,soil_adc,pump_on,pump_fault) VALUES(1,1000,3000,0,0)');
  db.exec('INSERT OR IGNORE INTO readings(minute_bucket,recorded_at,soil_adc,pump_on,pump_fault) VALUES(1,2000,3001,0,0)');
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM readings').get()!.count, 1);
  db.close();
});

test('demo jelas terpisah dan tidak menghasilkan data masa depan', () => {
  const data = demoHistory(wibDate());
  assert.ok(data.readings.every(r => r.recorded_at <= Date.now()));
  assert.ok(data.readings.every(r => r.soil_adc >= 0 && r.soil_adc <= 4095));
  assert.deepEqual(demoHistory('invalid'), { readings: [], events: [] });
});
