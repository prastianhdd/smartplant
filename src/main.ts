import './style.css';
import foliageUrl from './assets/foliage.svg?no-inline';
import { soilState, wibDate } from '../shared/types';
import type { HistoryResponse, LatestResponse } from '../shared/types';
import { demoHistory } from './demo';

type Page = 'overview' | 'history' | 'about';
type Metric = 'soil_adc' | 'temperature' | 'humidity';
interface InstallPrompt extends Event { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> }
const app = document.querySelector<HTMLDivElement>('#app')!;
const timeFormat = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const fullTime = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
const longDate = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const number = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 });
let page: Page = 'overview';
let date = wibDate();
let followToday = true;
let demo = false;
let latest: LatestResponse = { reading: null, online: false };
let history: HistoryResponse = { readings: [], events: [] };
let metric: Metric = 'soil_adc';
let tablePage = 0;
let error = '';
let cached = false;
let loading = true;
let installPrompt: InstallPrompt | null = null;
let requestId = 0;
let requestController: AbortController | null = null;
let tableOpen = false;
let loadedDate = date;

const paths: Record<string, string> = {
  leaf: '<path d="M20 4c-8-2-15 1-15 8a7 7 0 0 0 7 7c7 0 9-7 8-15Z"/><path d="m4 21 10-10"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
  history: '<path d="M3 11a9 9 0 1 1 2.5 7M3 4v7h7M12 7v5l3 2"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>',
  drop: '<path d="M12 3C9 8 5 11 5 15a7 7 0 0 0 14 0c0-4-4-7-7-12Z"/><path d="M8 15a4 4 0 0 0 4 4"/>',
  temp: '<path d="M9 14V5a3 3 0 0 1 6 0v9a5 5 0 1 1-6 0Z"/><path d="M12 8v9"/>',
  air: '<path d="M3 8h12a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h6a3 3 0 1 1-3 3"/>',
  pump: '<path d="M5 7h14v13H5zM9 7V3h6v4M9 13h6m-3-3v6M3 20h18"/>',
  arrow: '<path d="M7 17 17 7M7 7h10v10"/>',
  down: '<path d="M12 3v12m-5-5 5 5 5-5M5 16v5h14v-5"/>',
  refresh: '<path d="M20 7v5h-5M4 17v-5h5M6 6a8 8 0 0 1 13 1M5 17a8 8 0 0 0 13 1"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  wifi: '<path d="M3 8a15 15 0 0 1 18 0M6 12a10 10 0 0 1 12 0M9 16a5 5 0 0 1 6 0M12 20h.01"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
};
const icon = (name: string, className = '') => `<svg class="icon ${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? paths.leaf}</svg>`;
const plant = `<svg class="plant-art" viewBox="0 0 330 300" fill="none" aria-hidden="true"><ellipse cx="169" cy="274" rx="89" ry="12" fill="#153e2a" opacity=".09"/><path d="M158 217c-5-49 7-106 27-150" stroke="#426844" stroke-width="5" stroke-linecap="round"/><path d="M166 168c-28-16-45-40-49-63m49 40c29-7 51-29 61-50m-53 19c-11-27-11-48-4-68" stroke="#426844" stroke-width="3"/><path d="M159 164c-39 1-72-24-67-66 36-2 64 21 67 66Z" fill="#91ad76"/><path d="M169 140c10-40 38-67 77-58-4 38-36 63-77 58Z" fill="#557e51"/><path d="M176 103c-23-29-25-59-2-82 27 24 27 56 2 82Z" fill="#749760"/><path d="M187 81c1-28 20-48 48-43-1 29-20 48-48 43Z" fill="#a7bd86"/><path d="M157 192c-31-2-52-20-51-45 29-2 50 17 51 45Z" fill="#b4c895"/><path d="M169 180c15-28 40-37 64-24-11 29-34 38-64 24Z" fill="#87a46d"/><path d="m105 110 48 47m24-23 58-42m-59-59v57m17-18 31-24m-108 108 35 29m27-9 43-16" stroke="#f6f8e9" stroke-opacity=".35" stroke-width="1.5"/><path d="M117 211h100l-12 51c-2 9-14 15-38 15s-36-6-38-15l-12-51Z" fill="#c89973"/><path d="M117 211h50v66c-24 0-36-6-38-15l-12-51Z" fill="#b98460" opacity=".5"/><rect x="111" y="204" width="112" height="18" rx="5" fill="#d5aa86"/><path d="M128 230h76" stroke="#e4bd9b" stroke-width="2"/><circle cx="258" cy="185" r="22" fill="#fff" fill-opacity=".65"/><path d="m248 185 7 7 13-14" stroke="#426844" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M62 78h12m-6-6v12M259 49h8m-4-4v8" stroke="#9eb88c" stroke-width="2" stroke-linecap="round"/></svg>`;

function shell() {
  app.innerHTML = `<a class="skip-link" href="#main">Lewati ke konten</a>
    <aside class="sidebar">
      <a class="brand" href="#" aria-label="Smart Plant beranda"><span class="brand-symbol">${icon('leaf')}</span><span>smart<span class="brand-light">plant</span></span></a>
      <div class="nav-caption">RUANG TANAMAN</div>
      <nav aria-label="Navigasi utama">
        <button class="nav-item" data-page="overview">${icon('grid')}<span>Ringkasan</span></button>
        <button class="nav-item" data-page="history">${icon('history')}<span>Riwayat data</span></button>
        <button class="nav-item" data-page="about">${icon('info')}<span>Tentang proyek</span></button>
      </nav>
      <img class="sidebar-foliage" src="${foliageUrl}" alt="" aria-hidden="true" width="420" height="560"/>
      <div class="sidebar-bottom"><span class="device-dot"></span><div><strong>Smart Plant 01</strong><small>1 perangkat terdaftar</small></div>${icon('chevron')}</div>
    </aside>
    <div class="workspace"><header class="topbar"><div class="breadcrumb">Ruang tanaman ${icon('chevron')} <strong id="breadcrumb">Ringkasan</strong></div><div class="top-actions"><span class="timezone">WIB <span>UTC+7</span></span><button id="install" class="button compact" hidden>${icon('down')} Pasang aplikasi</button><span class="profile" title="Proyek Smart Plant">SP</span></div></header>
    <main id="main" tabindex="-1"></main><footer><span>Smart Plant · Monitoring ESP32</span><span>ESP32 + Cloudflare <span class="footer-dot">/</span> PWA</span></footer></div>
    <div id="toast" role="status" class="toast" hidden></div>`;
  app.addEventListener('click', async event => {
    const button = (event.target as HTMLElement).closest<HTMLElement>('button, a.brand');
    if (!button) return;
    if (button.matches('a.brand')) { event.preventDefault(); page = 'overview'; render(); }
    if (button.dataset.page) { page = button.dataset.page as Page; tablePage = 0; render(); window.scrollTo(0, 0); }
    if (button.dataset.metric) { metric = button.dataset.metric as Metric; render(); }
    if (button.id === 'demo-toggle') { demo = !demo; latest = { reading: null, online: false }; history = { readings: [], events: [] }; cached = false; tablePage = 0; error = ''; await load(); }
    if (button.id === 'refresh') await load();
    if (button.id === 'today') { date = wibDate(); followToday = true; tablePage = 0; await load(); }
    if (button.id === 'export') exportCsv();
    if (button.id === 'table-toggle') { tableOpen = !tableOpen; render(); }
    if (button.id === 'previous') { tablePage = Math.max(0, tablePage - 1); render(); }
    if (button.id === 'next') { tablePage++; render(); }
    if (button.id === 'install' && installPrompt) { await installPrompt.prompt(); await installPrompt.userChoice; installPrompt = null; button.hidden = true; }
  });
  app.addEventListener('change', event => {
    const input = event.target as HTMLInputElement;
    if (input.id === 'date' && input.validity.valid && input.value) { date = input.value; followToday = date === wibDate(); tablePage = 0; void load(); }
  });
}

function safeCacheRead() {
  try {
    const saved = JSON.parse(localStorage.getItem('smartplant-last') ?? 'null');
    if (saved && saved.date === date && saved.latest && saved.history) {
      latest = { ...saved.latest, online: false }; history = saved.history; cached = true;
    }
  } catch { /* Penyimpanan browser boleh tidak tersedia. */ }
}

async function load() {
  const id = ++requestId;
  requestController?.abort();
  requestController = new AbortController();
  if (followToday) date = wibDate();
  if (loadedDate !== date) { history = { readings: [], events: [] }; loadedDate = date; }
  if (demo) {
    history = demoHistory(date);
    const current = demoHistory(wibDate()).readings.at(-1) ?? null;
    latest = { reading: current, online: false }; cached = false; loading = false; error = ''; render(); return;
  }
  loading = true;
  if (!latest.reading && !history.readings.length) safeCacheRead();
  render();
  const timeout = setTimeout(() => requestController?.abort(), 12_000);
  try {
    const responses = await Promise.all([
      fetch('/api/latest', { cache: 'no-store', signal: requestController.signal }),
      fetch(`/api/history?date=${date}`, { cache: 'no-store', signal: requestController.signal }),
    ]);
    if (responses.some(response => !response.ok)) throw new Error('API_UNAVAILABLE');
    const [newLatest, newHistory] = await Promise.all(responses.map(response => response.json()));
    if (id !== requestId) return;
    latest = newLatest as LatestResponse; history = newHistory as HistoryResponse;
    error = ''; cached = false;
    try { localStorage.setItem('smartplant-last', JSON.stringify({ date, latest, history })); } catch { /* Tetap berfungsi tanpa cache lokal. */ }
  } catch {
    if (id !== requestId) return;
    latest.online = false; cached = !!latest.reading || history.readings.length > 0;
    error = navigator.onLine ? 'Data belum dapat dimuat. Periksa API dan database, lalu coba lagi.' : 'Kamu sedang offline. Data tersimpan mungkin sudah tidak terbaru.';
  } finally {
    clearTimeout(timeout);
    if (id === requestId) { loading = false; render(); }
  }
}

function statusPill() {
  const label = demo ? 'Mode demo' : cached ? 'Data tersimpan' : latest.online ? 'Perangkat online' : 'Perangkat offline';
  return `<span class="pill ${demo ? 'demo' : latest.online && !cached ? 'online' : 'offline'}"><span class="status-dot"></span>${label}</span>`;
}

function heading(title: string) {
  return `<div class="page-heading"><div><h1>${title}</h1></div><div class="heading-actions"><button class="button ${demo ? 'demo-active' : ''}" id="demo-toggle" aria-pressed="${demo}">${icon(demo ? 'close' : 'sun')}${demo ? 'Keluar demo' : 'Lihat demo'}</button><button class="button icon-button" id="refresh" aria-label="Perbarui data" ${loading ? 'disabled' : ''}>${icon('refresh', loading ? 'spin' : '')}</button></div></div>
  ${demo ? '<div class="notice demo-notice">Data simulasi untuk pratinjau presentasi. Bukan pembacaan ESP32; tidak disimpan ke database.</div>' : ''}
  ${error ? `<div class="notice error-notice" role="status">${error}</div>` : ''}`;
}

function overview() {
  const r = latest.reading;
  const stale = !demo && (!latest.online || cached);
  const state = r ? soilState(r.soil_adc) : 'Menunggu data';
  return `${heading('Monitoring tanaman')}
    <section class="device-summary" aria-label="Status perangkat"><strong>${icon('leaf')} Smart Plant 01</strong>${statusPill()}<span>${longDate.format(Date.now())}</span></section>
    <section class="section-heading"><div><h2>Data sensor</h2><p>${demo ? 'Pratinjau kondisi tanaman menggunakan data simulasi.' : r ? `Pembacaan terakhir ${fullTime.format(r.recorded_at)} WIB${stale ? ' · bukan data langsung' : ''}` : 'Menunggu kiriman pertama dari ESP32.'}</p></div><span class="small-label">${icon('refresh')} Setiap 10 detik</span></section>
    <section class="metrics" aria-label="Pembacaan sensor terbaru">
      ${stat('drop', 'Kondisi tanah', r ? number.format(r.soil_adc) : '—', 'ADC', state, r ? 'Semakin rendah, semakin basah' : 'Sensor kelembapan tanah', 'soil')}
      ${stat('temp', 'Suhu udara', r?.temperature != null ? number.format(r.temperature) : '—', '°C', 'DHT22', r?.temperature == null ? 'Belum ada pembacaan valid' : 'Suhu lingkungan tanaman', 'temperature')}
      ${stat('air', 'Kelembapan udara', r?.humidity != null ? number.format(r.humidity) : '—', '%', 'DHT22', r?.humidity == null ? 'Belum ada pembacaan valid' : 'Kelembapan relatif udara', 'humidity')}
      ${stat('pump', 'Pompa air', r ? r.pump_fault ? 'Terhenti' : r.pump_on ? 'Menyiram' : 'Istirahat' : '—', '', r?.pump_fault ? 'Pengaman aktif' : 'Otomatis', r?.pump_fault ? 'Periksa sistem, lalu reset ESP32' : r?.pump_on ? 'Menyala hingga ADC ≤ 2700' : 'Menyala saat ADC ≥ 3200', 'pump')}
    </section>
    <div class="section-heading trend-heading"><div><h2>Grafik sensor</h2></div><button class="text-button" data-page="history">Riwayat lengkap ${icon('arrow')}</button></div>
    ${filters()}
    <div class="content-grid"><section class="card chart-card">${chart()}</section><section class="card activity-card"><div class="card-heading"><h3>Aktivitas penyiraman</h3><span class="icon-box">${icon('drop')}</span></div>${eventsList(4)}</section></div>`;
}

function stat(symbol: string, title: string, value: string, unit: string, badge: string, note: string, type: string) {
  const watering = type === 'pump' && value === 'Menyiram' && (demo || latest.online && !cached);
  return `<article class="card stat-card ${type}${watering ? ' is-watering' : ''}"><div class="stat-top"><span class="icon-box">${icon(symbol)}</span><span class="stat-tag">${badge}</span></div><h3>${title}</h3><div class="stat-value ${type === 'pump' ? 'word-value' : ''}">${value}<span>${unit}</span></div>${badge === 'Pengaman aktif' ? `<p>${note}</p>` : ''}</article>`;
}

function filters() {
  return `<div class="filter-row"><div class="date-control"><label for="date">${icon('history')} Tanggal data</label><input id="date" type="date" value="${date}" max="${wibDate()}" required aria-label="Tanggal riwayat dalam WIB"/><span>WIB</span></div><button class="text-button today-button" id="today">Hari ini</button><span class="filter-count">${history.readings.length.toLocaleString('id-ID')} pembacaan${cached ? ' · tersimpan' : ''}</span></div>`;
}

const metricInfo: Record<Metric, { label: string; unit: string; min: number; max: number }> = {
  soil_adc: { label: 'Kelembapan tanah', unit: 'ADC', min: 0, max: 4095 },
  temperature: { label: 'Suhu udara', unit: '°C', min: -40, max: 80 },
  humidity: { label: 'Kelembapan udara', unit: '%', min: 0, max: 100 },
};

function chart() {
  const info = metricInfo[metric];
  const data = history.readings;
  const valid = data.filter(r => r[metric] !== null);
  const choices = `<div class="chart-tabs" role="group" aria-label="Sensor yang ditampilkan">${(['soil_adc', 'temperature', 'humidity'] as Metric[]).map(key => `<button data-metric="${key}" class="${metric === key ? 'active' : ''}" aria-pressed="${metric === key}">${key === 'soil_adc' ? 'Tanah' : key === 'temperature' ? 'Suhu' : 'Udara'}</button>`).join('')}</div>`;
  let graph: string;
  if (!valid.length) graph = `<div class="empty-chart">${icon('leaf')}<strong>Belum ada jejak pertumbuhan</strong><p>${demo ? 'Tidak ada data simulasi untuk tanggal ini.' : 'Data akan muncul setelah ESP32 mengirim pembacaan.'}</p></div>`;
  else {
    const values = valid.map(r => r[metric]!);
    const low = metric === 'soil_adc' ? 2200 : metric === 'humidity' ? 40 : 20;
    const high = metric === 'soil_adc' ? 3600 : metric === 'humidity' ? 100 : 36;
    const min = Math.max(info.min, Math.min(low, Math.floor(Math.min(...values) / 5) * 5));
    const max = Math.min(info.max, Math.max(high, Math.ceil(Math.max(...values) / 5) * 5));
    const start = Date.parse(`${date}T00:00:00+07:00`);
    const x = (time: number) => 52 + (time - start) / 86_400_000 * 668;
    const y = (value: number) => 204 - (value - min) / (max - min) * 170;
    const segments: string[][] = [];
    let segment: string[] = [];
    for (const r of data) {
      const value = r[metric];
      if (value === null) { segment = []; continue; }
      if (!segment.length) segments.push(segment);
      segment.push(`${x(r.recorded_at).toFixed(2)},${y(value).toFixed(2)}`);
    }
    const line = segments.map(points => `M${points.join(' L')}`).join(' ');
    const area = segments.map(points => `M${points.join(' L')} L${points.at(-1)!.split(',')[0]},204 L${points[0].split(',')[0]},204 Z`).join(' ');
    const ticks = Array.from({ length: 5 }, (_, i) => min + (max - min) * i / 4);
    const thresholds = metric === 'soil_adc' ? [2700, 3200].map(value => `<line class="threshold" x1="52" x2="720" y1="${y(value)}" y2="${y(value)}"/><text class="threshold-label" x="716" y="${y(value) - 5}" text-anchor="end">${value === 2700 ? 'Batas basah' : 'Batas kering'} ${value}</text>`).join('') : '';
    graph = `<div class="plot-wrap"><svg id="chart" viewBox="0 0 752 246" role="img" aria-label="Grafik ${info.label} dalam ${info.unit}, tanggal ${date}. Data lengkap tersedia dalam tabel.">
      <defs><linearGradient id="chart-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--chart)" stop-opacity=".22"/><stop offset="1" stop-color="var(--chart)" stop-opacity=".015"/></linearGradient></defs>
      ${ticks.map(value => `<line class="gridline" x1="52" x2="720" y1="${y(value)}" y2="${y(value)}"/><text class="axis-label" x="41" y="${y(value) + 4}" text-anchor="end">${number.format(value)}</text>`).join('')}
      <path class="data-area" fill="url(#chart-area)" d="${area}"/>${thresholds}<path class="data-line" d="${line}"/>
      ${[0, 4, 8, 12, 16, 20, 24].map(hour => `<text class="axis-label" x="${52 + hour / 24 * 668}" y="230" text-anchor="middle">${String(hour).padStart(2, '0')}:00</text>`).join('')}
      <g id="crosshair" visibility="hidden"><line y1="28" y2="205"/><circle r="4"/></g>
      <rect id="chart-target" x="52" y="24" width="668" height="184" fill="transparent" tabindex="0" role="slider" aria-label="Jelajahi pembacaan grafik dengan tombol panah" aria-valuemin="0" aria-valuemax="${data.length - 1}" aria-valuenow="0"/>
      </svg><div id="chart-tooltip" class="chart-tooltip" hidden></div></div>`;
  }
  return `<div class="card-heading"><div><h3>${info.label}</h3><p>${info.unit}${metric === 'soil_adc' ? ' · nilai lebih rendah = tanah lebih basah' : ' · waktu dalam WIB'}</p></div>${choices}</div>${graph}<div class="chart-bottom"><span><i class="line-key"></i> ${info.label}${demo ? ' · simulasi' : ''}</span><button class="text-button" id="table-toggle" aria-expanded="${tableOpen}">${tableOpen ? 'Sembunyikan tabel' : 'Lihat tabel data'} ${icon('chevron')}</button></div>${tableOpen ? dataTable() : ''}`;
}

function eventsList(limit = 100) {
  const events = history.events.slice(-limit).reverse();
  if (!events.length) return `<div class="empty-activity">${icon('drop')}<p>Belum ada aktivitas penyiraman<br>pada tanggal ini.</p></div>`;
  return `<ol class="event-list">${events.map(event => `<li><span class="event-icon ${event.pump_on ? 'watering' : ''}">${icon(event.pump_on ? 'drop' : 'check')}</span><div><strong>${event.pump_on ? 'Penyiraman dimulai' : 'Penyiraman selesai'}</strong><p>ADC ${number.format(event.soil_adc)} <span>·</span> ${event.pump_on ? 'Pompa ON' : 'Pompa OFF'}</p></div><time datetime="${new Date(event.recorded_at).toISOString()}">${timeFormat.format(event.recorded_at)}</time></li>`).join('')}</ol>`;
}

function historyPage() {
  const onCount = history.events.filter(e => e.pump_on).length;
  return `${heading('Riwayat data')}
    ${filters()}<div class="history-summary"><span>${icon('history')} <strong>${history.readings.length.toLocaleString('id-ID')}</strong> pembacaan tersimpan</span><span>${icon('drop')} <strong>${onCount}</strong> penyiraman dimulai</span><button class="button compact" id="export" ${!history.readings.length ? 'disabled' : ''}>${icon('down')} Unduh CSV</button></div>
    <section class="card chart-card">${chart()}</section>
    ${!tableOpen ? `<section class="card history-table"><div class="card-heading"><div><h3>Catatan sensor</h3><p>Tanggal dd/mm/yy · waktu Indonesia Barat</p></div><span class="stat-tag">${demo ? 'Data simulasi' : 'Data ESP32'}</span></div>${dataTable()}</section>` : ''}
    <section class="card history-events"><div class="card-heading"><div><h3>Jurnal penyiraman</h3><p>Perubahan status pompa yang tercatat pada tanggal terpilih.</p></div>${icon('drop')}</div>${eventsList()}</section>`;
}

function dataTable() {
  const total = Math.max(1, Math.ceil(history.readings.length / 15));
  tablePage = Math.min(tablePage, total - 1);
  const rows = history.readings.slice().reverse().slice(tablePage * 15, (tablePage + 1) * 15);
  return `<div class="table-scroll"><table><caption class="sr-only">Riwayat sensor ${date} dalam WIB${demo ? ', data simulasi' : ''}</caption><thead><tr><th scope="col">Waktu (WIB)</th><th scope="col">Tanah (ADC)</th><th scope="col">Suhu (°C)</th><th scope="col">Udara (%)</th><th scope="col">Kondisi</th><th scope="col">Pompa</th></tr></thead><tbody>${rows.length ? rows.map(r => `<tr><td>${fullTime.format(r.recorded_at)}</td><td>${number.format(r.soil_adc)}</td><td>${r.temperature === null ? '—' : number.format(r.temperature)}</td><td>${r.humidity === null ? '—' : number.format(r.humidity)}</td><td>${soilState(r.soil_adc)}</td><td><span class="table-status ${r.pump_on ? 'on' : ''}">${r.pump_fault ? 'Pengaman aktif' : r.pump_on ? 'ON' : 'OFF'}</span></td></tr>`).join('') : '<tr><td colspan="6" class="empty-cell">Belum ada pembacaan pada tanggal ini.</td></tr>'}</tbody></table></div><div class="pagination"><span>Halaman ${tablePage + 1} dari ${total}</span><div><button class="button compact" id="previous" ${tablePage === 0 ? 'disabled' : ''}>Sebelumnya</button><button class="button compact" id="next" ${tablePage >= total - 1 ? 'disabled' : ''}>Berikutnya</button></div></div>`;
}

function aboutPage() {
  return `${heading('Tentang proyek')}
  <section class="card about-intro"><div><h2>Smart Plant ESP32</h2><p>Smart Plant membaca kondisi tanah, suhu, dan kelembapan udara. ESP32 mengambil keputusan penyiraman secara lokal, sementara website ini menjadi jendela untuk melihat kondisi serta riwayatnya.</p><div class="tech-tags"><span>ESP32</span><span>Vite + TypeScript</span><span>Cloudflare Workers</span><span>D1</span><span>PWA</span></div></div>${plant}</section>
  <div class="about-grid"><section class="card about-card"><span class="icon-box">${icon('drop')}</span><h3>Penyiraman dengan hysteresis</h3><ol class="logic-list"><li><strong>ADC ≥ 3200</strong><span>Tanah kering. Pompa mulai menyiram.</span></li><li><strong>ADC 2700–3200</strong><span>Status pompa dipertahankan, tidak berulang ON/OFF.</span></li><li><strong>ADC ≤ 2700</strong><span>Tanah basah. Pompa berhenti.</span></li></ol><p class="fine-print">Pengaman firmware mematikan pompa setelah maksimal 60 detik. Periksa kondisi perangkat sebelum melakukan reset.</p></section>
  <section class="card about-card"><span class="icon-box">${icon('history')}</span><h3>Pencatatan data</h3><ul class="feature-list"><li>${icon('check')} Data terbaru dikirim setiap 10 detik.</li><li>${icon('check')} Satu pembacaan riwayat disimpan per menit.</li><li>${icon('check')} Perubahan pompa tercatat saat diterima server.</li><li>${icon('check')} Semua tanggal dan waktu menggunakan WIB.</li><li>${icon('check')} Website hanya monitoring, tanpa kontrol pompa.</li></ul><p class="fine-print">Saat internet terputus, otomatisasi tetap berjalan. Data selama putus koneksi tidak diunggah ulang oleh firmware versi awal.</p></section></div>
  <section class="care-strip">${icon('info')}<div><h3>Keterangan sensor</h3><p>Sensor tanah ditampilkan sebagai ADC, bukan persentase tanpa kalibrasi. Mode demo selalu ditandai dan tidak mengubah database.</p></div></section>`;
}

function render() {
  document.querySelectorAll<HTMLElement>('[data-page]').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
    if (el.dataset.page === page) el.setAttribute('aria-current', 'page'); else el.removeAttribute('aria-current');
  });
  document.querySelector('#breadcrumb')!.textContent = page === 'overview' ? 'Ringkasan' : page === 'history' ? 'Riwayat data' : 'Tentang proyek';
  const main = document.querySelector<HTMLElement>('#main')!;
  const previousValues = [...main.querySelectorAll('.stat-value')].map(el => el.textContent);
  main.innerHTML = page === 'overview' ? overview() : page === 'history' ? historyPage() : aboutPage();
  main.querySelectorAll('.stat-value').forEach((el, i) => {
    if (previousValues[i] && previousValues[i] !== el.textContent) el.classList.add('value-updated');
  });
  main.setAttribute('aria-busy', String(loading));
  main.classList.toggle('refreshing', loading && history.readings.length > 0);
  attachChart();
}

function attachChart() {
  const target = document.querySelector<SVGRectElement>('#chart-target');
  const svg = document.querySelector<SVGSVGElement>('#chart');
  if (!target || !svg) return;
  const cross = document.querySelector<SVGGElement>('#crosshair')!;
  const tooltip = document.querySelector<HTMLElement>('#chart-tooltip')!;
  const data = history.readings;
  let index = 0;
  function show(i: number) {
    index = Math.max(0, Math.min(data.length - 1, i));
    const r = data[index];
    const value = r[metric];
    const start = Date.parse(`${date}T00:00:00+07:00`);
    const x = 52 + (r.recorded_at - start) / 86_400_000 * 668;
    cross.setAttribute('visibility', 'visible');
    const line = cross.querySelector('line')!;
    line.setAttribute('x1', String(x)); line.setAttribute('x2', String(x));
    cross.querySelector('circle')!.setAttribute('visibility', 'hidden');
    tooltip.hidden = false;
    tooltip.textContent = `${timeFormat.format(r.recorded_at)} WIB · ${value === null ? 'Tidak ada data' : `${number.format(value)} ${metricInfo[metric].unit}`}`;
    tooltip.style.left = `${Math.max(22, Math.min(76, x / 752 * 100))}%`;
    target!.setAttribute('aria-valuenow', String(index));
    target!.setAttribute('aria-valuetext', tooltip.textContent);
  }
  target.addEventListener('pointermove', event => {
    const rect = svg.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width * 752;
    const start = Date.parse(`${date}T00:00:00+07:00`);
    const time = start + (x - 52) / 668 * 86_400_000;
    let best = 0;
    for (let i = 1; i < data.length; i++) if (Math.abs(data[i].recorded_at - time) < Math.abs(data[best].recorded_at - time)) best = i;
    show(best);
  });
  const hide = () => { cross.setAttribute('visibility', 'hidden'); tooltip.hidden = true; };
  target.addEventListener('pointerleave', hide);
  target.addEventListener('blur', hide);
  target.addEventListener('focus', () => show(index));
  target.addEventListener('keydown', event => {
    if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      event.preventDefault(); show(event.key === 'Home' ? 0 : event.key === 'End' ? data.length - 1 : index + (event.key === 'ArrowRight' ? 1 : -1));
    }
  });
}

function exportCsv() {
  const header = 'tanggal_waktu_WIB,tanah_ADC,suhu_C,kelembapan_udara_persen,pompa,pengaman,sumber';
  const rows = history.readings.map(r => [fullTime.format(r.recorded_at).replaceAll(',', ''), r.soil_adc, r.temperature ?? '', r.humidity ?? '', r.pump_on ? 'ON' : 'OFF', r.pump_fault ? 'AKTIF' : 'NORMAL', demo ? 'SIMULASI' : 'ESP32'].join(','));
  const url = URL.createObjectURL(new Blob(['﻿', header, '\r\n', rows.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = `smartplant-${date.slice(8)}${date.slice(5, 7)}${date.slice(2, 4)}${demo ? '-demo' : ''}.csv`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault(); installPrompt = event as InstallPrompt;
  document.querySelector<HTMLButtonElement>('#install')!.hidden = false;
});
window.addEventListener('online', () => void load());
window.addEventListener('offline', () => void load());
document.addEventListener('visibilitychange', () => { if (!document.hidden) void load(); });
shell();
void load();
setInterval(() => {
  if (!document.hidden && !document.activeElement?.matches('input, [role="slider"]')) void load();
}, 10_000);
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => { void navigator.serviceWorker.register('/sw.js').catch(() => { /* Monitoring tetap berfungsi jika pemasangan PWA gagal. */ }); });
}
