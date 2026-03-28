const DB_NAME = 'premi-panenscorer-db';
const DB_VERSION = 1;
const STORE_FILES = 'files';
const STORE_STATE = 'state';

const state = {
  uploadedFiles: [],
  parsedFiles: [],
  dailyRows: [],
  filteredRows: [],
  unitRecap: [],
  workerRecap: [],
  unitMatrices: [],
  filters: {
    month: '',
    unit: '',
    dateFrom: '',
    dateTo: '',
    q: ''
  }
};

const el = {
  fileInput: document.getElementById('fileInput'),
  btnProcess: document.getElementById('btnProcess'),
  btnDownload: document.getElementById('btnDownload'),
  btnClear: document.getElementById('btnClear'),
  btnApplyFilter: document.getElementById('btnApplyFilter'),
  btnResetFilter: document.getElementById('btnResetFilter'),
  fileList: document.getElementById('fileList'),
  selectedInfo: document.getElementById('selectedInfo'),
  previewBody: document.getElementById('previewBody'),
  previewFoot: document.getElementById('previewFoot'),
  unitBody: document.getElementById('unitBody'),
  workerBody: document.getElementById('workerBody'),
  matrixProdWrap: document.getElementById('matrixProdWrap'),
  matrixAbsWrap: document.getElementById('matrixAbsWrap'),
  searchInput: document.getElementById('searchInput'),
  monthFilter: document.getElementById('monthFilter'),
  unitFilter: document.getElementById('unitFilter'),
  dateFrom: document.getElementById('dateFrom'),
  dateTo: document.getElementById('dateTo'),
  statFiles: document.getElementById('statFiles'),
  statWorkers: document.getElementById('statWorkers'),
  statRows: document.getElementById('statRows'),
  statProd: document.getElementById('statProd'),
  loadingOverlay: document.getElementById('loadingOverlay'),
  loadingText: document.getElementById('loadingText')
};

function showLoading(text = 'Mohon tunggu sebentar.') {
  el.loadingText.textContent = text;
  el.loadingOverlay.classList.remove('hidden-force');
  el.loadingOverlay.classList.add('flex');
}
function hideLoading() {
  el.loadingOverlay.classList.add('hidden-force');
  el.loadingOverlay.classList.remove('flex');
}

function fmtNum(n, digits = 2) {
  const x = Number(n || 0);
  return x.toLocaleString('id-ID', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
function fmtInt(n) {
  return Number(n || 0).toLocaleString('id-ID');
}
function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[m]));
}
function scoreClass(score) {
  return `score-${Number(score ?? 0)}`;
}
function toISO(dateObj) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
function parseIDDate(value) {
  if (!value) return null;
  const v = String(value).trim();
  const m = v.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!m) return null;
  const date = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return isNaN(date.getTime()) ? null : date;
}
function monthKeyFromDate(dateObj) {
  return `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
}
function monthLabel(monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  const date = new Date(y, m - 1, 1);
  return date.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
}
function parseDec(val) {
  if (val === null || val === undefined) return 0;
  let s = String(val).replace(/\u00a0/g, ' ').trim();
  if (!s) return 0;
  s = s.replace(/\./g, '').replace(/,/g, '.').replace(/\s+/g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}
function inferUnitName(fileName) {
  const raw = String(fileName || '').replace(/\.[^.]+$/, '');
  return raw.replace(/[_-]?bhp.*$/i, '').replace(/[_-]+/g, ' ').trim().toUpperCase() || raw.toUpperCase();
}
function normalizeHeaderName(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}
function normalizeKey(str) {
  return String(str || '').trim().toLowerCase();
}
function productivityScore(pct) {
  if (pct > 110) return 5;
  if (pct >= 100) return 4;
  if (pct >= 90) return 3;
  if (pct >= 75) return 2;
  return 1;
}

function dayLabelFromISO(dateISO) {
  const m = String(dateISO || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return dateISO || '';
  return String(Number(m[3]));
}
function shortDateLabel(dateISO) {
  const m = String(dateISO || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return dateISO || '';
  return `${m[3]}/${m[2]}`;
}
function avgScoreFromValues(values) {
  if (!values || !values.length) return 0;
  return values.reduce((s, v) => s + Number(v || 0), 0) / values.length;
}

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_FILES)) db.createObjectStore(STORE_FILES, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(STORE_STATE)) db.createObjectStore(STORE_STATE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbPut(storeName, value) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).put(value);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}
async function idbGetAll(storeName) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}
async function idbDeleteDatabase() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve(false);
  });
}

async function saveStateToDb() {
  await idbPut(STORE_STATE, { id: 'appState', data: {
    parsedFiles: state.parsedFiles,
    dailyRows: state.dailyRows,
    filters: state.filters
  }});
}
async function loadStateFromDb() {
  const files = await idbGetAll(STORE_FILES);
  state.uploadedFiles = files.map(x => ({ id: x.id, name: x.name, size: x.size, lastModified: x.lastModified }));
  const saved = await idbGetAll(STORE_STATE);
  const appState = saved.find(x => x.id === 'appState');
  if (appState?.data) {
    state.parsedFiles = appState.data.parsedFiles || [];
    state.dailyRows = appState.data.dailyRows || [];
    state.filters = { ...state.filters, ...(appState.data.filters || {}) };
  }
}

function renderSelectedFiles() {
  if (!state.uploadedFiles.length) {
    el.selectedInfo.textContent = 'Belum ada file dipilih.';
    el.fileList.innerHTML = '';
    return;
  }
  el.selectedInfo.textContent = `${state.uploadedFiles.length} file tersimpan / dipilih.`;
  el.fileList.innerHTML = state.uploadedFiles.map(f => `
    <div class="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
      <div class="font-medium">${escapeHtml(f.name)}</div>
      <div class="text-xs text-slate-500">${fmtInt(f.size || 0)} byte</div>
    </div>
  `).join('');
}

function populateFilters() {
  const monthSet = new Set();
  const unitSet = new Set();
  for (const row of state.dailyRows) {
    if (row.monthKey) monthSet.add(row.monthKey);
    if (row.unit) unitSet.add(row.unit);
  }
  const months = Array.from(monthSet).sort();
  const units = Array.from(unitSet).sort();
  el.monthFilter.innerHTML = `<option value="">Semua Bulan</option>` + months.map(m => `<option value="${m}">${monthLabel(m)}</option>`).join('');
  el.unitFilter.innerHTML = `<option value="">Semua Unit</option>` + units.map(u => `<option value="${escapeHtml(u)}">${escapeHtml(u)}</option>`).join('');
  el.monthFilter.value = state.filters.month || '';
  el.unitFilter.value = state.filters.unit || '';
  el.dateFrom.value = state.filters.dateFrom || '';
  el.dateTo.value = state.filters.dateTo || '';
  el.searchInput.value = state.filters.q || '';
}

function applyFilters() {
  state.filters.month = el.monthFilter.value || '';
  state.filters.unit = el.unitFilter.value || '';
  state.filters.dateFrom = el.dateFrom.value || '';
  state.filters.dateTo = el.dateTo.value || '';
  state.filters.q = (el.searchInput.value || '').trim();

  const q = normalizeKey(state.filters.q);
  state.filteredRows = state.dailyRows.filter(row => {
    if (state.filters.month && row.monthKey !== state.filters.month) return false;
    if (state.filters.unit && row.unit !== state.filters.unit) return false;
    if (state.filters.dateFrom && row.dateISO < state.filters.dateFrom) return false;
    if (state.filters.dateTo && row.dateISO > state.filters.dateTo) return false;
    if (q) {
      const hay = normalizeKey(`${row.unit} ${row.nip} ${row.nama}`);
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  buildRecaps();
  renderAll();
  saveStateToDb().catch(console.error);
}

function buildRecaps() {
  const unitMap = new Map();
  const workerMap = new Map();

  for (const row of state.filteredRows) {
    const uKey = row.unit;
    if (!unitMap.has(uKey)) {
      unitMap.set(uKey, {
        unit: row.unit,
        hk: 0,
        workerSet: new Set(),
        prodSum: 0,
        absSum: 0,
        prodCount: 0
      });
    }
    const u = unitMap.get(uKey);
    u.hk += 1;
    u.workerSet.add(row.nip || row.nama);
    u.prodSum += Number(row.productivityScore || 0);
    u.absSum += Number(row.attendanceScore || 0);
    u.prodCount += 1;

    const wKey = `${row.unit}__${row.nip}__${row.nama}`;
    if (!workerMap.has(wKey)) {
      workerMap.set(wKey, {
        unit: row.unit,
        nip: row.nip,
        nama: row.nama,
        hk: 0,
        prodSum: 0,
        absSum: 0
      });
    }
    const w = workerMap.get(wKey);
    w.hk += 1;
    w.prodSum += Number(row.productivityScore || 0);
    w.absSum += Number(row.attendanceScore || 0);
  }

  state.unitRecap = Array.from(unitMap.values()).map(v => ({
    unit: v.unit,
    hk: v.hk,
    workers: v.workerSet.size,
    avgProd: v.prodCount ? v.prodSum / v.prodCount : 0,
    avgAbs: v.prodCount ? v.absSum / v.prodCount : 0
  })).sort((a, b) => a.unit.localeCompare(b.unit));

  state.workerRecap = Array.from(workerMap.values()).map(v => ({
    unit: v.unit,
    nip: v.nip,
    nama: v.nama,
    hk: v.hk,
    avgProd: v.hk ? v.prodSum / v.hk : 0,
    avgAbs: v.hk ? v.absSum / v.hk : 0
  })).sort((a, b) => a.unit.localeCompare(b.unit) || a.nama.localeCompare(b.nama));


  buildUnitMatrices();
}

function buildUnitMatrices() {
  const byUnit = new Map();
  for (const row of state.filteredRows) {
    if (!byUnit.has(row.unit)) byUnit.set(row.unit, []);
    byUnit.get(row.unit).push(row);
  }

  state.unitMatrices = Array.from(byUnit.entries()).map(([unit, rows]) => {
    const dateList = Array.from(new Set(rows.map(r => r.dateISO))).sort();
    const dateHeaders = dateList.map(dateISO => ({
      dateISO,
      dayLabel: dayLabelFromISO(dateISO),
      shortLabel: shortDateLabel(dateISO)
    }));

    const workerMap = new Map();
    for (const row of rows) {
      const key = `${row.divisi || ''}__${row.nip || ''}__${row.nama || ''}`;
      if (!workerMap.has(key)) {
        workerMap.set(key, {
          unit,
          divisi: row.divisi || '',
          nip: row.nip || '',
          nama: row.nama || '',
          prodByDate: {},
          absByDate: {}
        });
      }
      const item = workerMap.get(key);
      item.prodByDate[row.dateISO] = Number(row.productivityScore || 0);
      item.absByDate[row.dateISO] = Number(row.attendanceScore || 0);
    }

    const workers = Array.from(workerMap.values()).map(item => {
      const prodValues = dateList.map(d => Number(item.prodByDate[d] || 0));
      const absValues = dateList.map(d => Number(item.absByDate[d] || 0));
      return {
        ...item,
        prodValues,
        absValues,
        avgProd: avgScoreFromValues(prodValues),
        avgAbs: avgScoreFromValues(absValues)
      };
    }).sort((a, b) =>
      String(a.divisi || '').localeCompare(String(b.divisi || ''), 'id') ||
      String(a.nama || '').localeCompare(String(b.nama || ''), 'id') ||
      String(a.nip || '').localeCompare(String(b.nip || ''), 'id')
    );

    return { unit, dateHeaders, workers };
  }).sort((a, b) => a.unit.localeCompare(b.unit));
}

function renderAll() {
  renderSelectedFiles();
  renderStats();
  renderPreview();
  renderUnitRecap();
  renderWorkerRecap();
  renderMatrices();
  el.btnDownload.disabled = !state.dailyRows.length;
}

function renderStats() {
  const workerSet = new Set(state.filteredRows.map(r => `${r.unit}__${r.nip}__${r.nama}`));
  const fileSet = new Set(state.filteredRows.map(r => r.fileName));
  const avgProd = state.filteredRows.length ? state.filteredRows.reduce((s, r) => s + Number(r.productivityScore || 0), 0) / state.filteredRows.length : 0;
  el.statFiles.textContent = fmtInt(fileSet.size || state.uploadedFiles.length);
  el.statWorkers.textContent = fmtInt(workerSet.size);
  el.statRows.textContent = fmtInt(state.filteredRows.length);
  el.statProd.textContent = fmtNum(avgProd, 2);
}

function renderPreview() {
  const rows = state.filteredRows.slice(0, 500);
  if (!rows.length) {
    el.previewBody.innerHTML = `<tr><td colspan="9" class="px-4 py-6 text-center text-slate-500">Belum ada data untuk ditampilkan.</td></tr>`;
    el.previewFoot.textContent = '';
    return;
  }
  el.previewBody.innerHTML = rows.map(r => `
    <tr class="border-t border-slate-200">
      <td class="px-3 py-2">${escapeHtml(r.unit)}</td>
      <td class="px-3 py-2">${escapeHtml(r.dateDisplay)}</td>
      <td class="px-3 py-2">${escapeHtml(r.nip)}</td>
      <td class="px-3 py-2">${escapeHtml(r.nama)}</td>
      <td class="px-3 py-2 text-right">${fmtNum(r.quantity, 2)}</td>
      <td class="px-3 py-2 text-right">${fmtNum(r.basisProrata, 2)}</td>
      <td class="px-3 py-2 text-right">${fmtNum(r.productivityPct, 2)}%</td>
      <td class="px-3 py-2 text-center"><span class="inline-flex min-w-[36px] justify-center px-2 py-1 rounded-lg font-semibold ${scoreClass(r.productivityScore)}">${r.productivityScore}</span></td>
      <td class="px-3 py-2 text-center"><span class="inline-flex min-w-[36px] justify-center px-2 py-1 rounded-lg font-semibold ${scoreClass(r.attendanceScore)}">${r.attendanceScore}</span></td>
    </tr>
  `).join('');
  el.previewFoot.textContent = `Menampilkan ${fmtInt(rows.length)} dari ${fmtInt(state.filteredRows.length)} baris.`;
}

function renderUnitRecap() {
  if (!state.unitRecap.length) {
    el.unitBody.innerHTML = `<tr><td colspan="5" class="px-4 py-6 text-center text-slate-500">Belum ada rekap unit.</td></tr>`;
    return;
  }
  el.unitBody.innerHTML = state.unitRecap.map(r => `
    <tr class="border-t border-slate-200">
      <td class="px-3 py-2">${escapeHtml(r.unit)}</td>
      <td class="px-3 py-2 text-right">${fmtInt(r.hk)}</td>
      <td class="px-3 py-2 text-right">${fmtInt(r.workers)}</td>
      <td class="px-3 py-2 text-right">${fmtNum(r.avgProd, 2)}</td>
      <td class="px-3 py-2 text-right">${fmtNum(r.avgAbs, 2)}</td>
    </tr>
  `).join('');
}

function renderWorkerRecap() {
  if (!state.workerRecap.length) {
    el.workerBody.innerHTML = `<tr><td colspan="6" class="px-4 py-6 text-center text-slate-500">Belum ada rekap tenaga kerja.</td></tr>`;
    return;
  }
  el.workerBody.innerHTML = state.workerRecap.slice(0, 1000).map(r => `
    <tr class="border-t border-slate-200">
      <td class="px-3 py-2">${escapeHtml(r.unit)}</td>
      <td class="px-3 py-2">${escapeHtml(r.nip)}</td>
      <td class="px-3 py-2">${escapeHtml(r.nama)}</td>
      <td class="px-3 py-2 text-right">${fmtInt(r.hk)}</td>
      <td class="px-3 py-2 text-right">${fmtNum(r.avgProd, 2)}</td>
      <td class="px-3 py-2 text-right">${fmtNum(r.avgAbs, 2)}</td>
    </tr>
  `).join('');
}

function renderMatrixTables(type) {
  if (!state.unitMatrices.length) {
    return `<div class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-slate-500">Belum ada matrik untuk ditampilkan.</div>`;
  }
  return state.unitMatrices.map(unitData => {
    const isProd = type === 'prod';
    const title = isProd ? 'Matrik Skor Produktivitas' : 'Matrik Skor Kehadiran';
    const avgKey = isProd ? 'avgProd' : 'avgAbs';
    const valueKey = isProd ? 'prodValues' : 'absValues';
    const tableHead = unitData.dateHeaders.map(h => `<th class="px-2 py-2 text-center min-w-[44px]" title="${h.shortLabel}">${h.dayLabel}</th>`).join('');
    const body = unitData.workers.map(w => {
      const cells = w[valueKey].map(v => `<td class="px-2 py-2 text-center"><span class="inline-flex w-9 h-8 items-center justify-center rounded-md font-bold ${scoreClass(v)}">${v}</span></td>`).join('');
      return `
        <tr class="border-t border-slate-700/80">
          <td class="px-3 py-2 text-center whitespace-nowrap">${escapeHtml(w.divisi || '-')}</td>
          <td class="px-3 py-2 whitespace-nowrap">${escapeHtml(w.nip)}</td>
          <td class="px-3 py-2 whitespace-nowrap">${escapeHtml(w.nama)}</td>
          ${cells}
          <td class="px-3 py-2 text-right font-semibold whitespace-nowrap">${fmtNum(w[avgKey], 2)}</td>
        </tr>
      `;
    }).join('') || `<tr><td colspan="${4 + unitData.dateHeaders.length}" class="px-4 py-6 text-center text-slate-400">Belum ada data unit.</td></tr>`;

    return `
      <section class="rounded-3xl border border-slate-800 bg-slate-950 text-white overflow-hidden shadow-sm">
        <div class="px-5 py-4 bg-gradient-to-r from-slate-950 via-blue-950 to-slate-950 border-b border-slate-800">
          <div class="flex flex-col md:flex-row md:items-end md:justify-between gap-2">
            <div>
              <h3 class="text-lg font-bold">${title} - ${escapeHtml(unitData.unit)}</h3>
              <p class="text-xs text-slate-300 mt-1">Rentang tanggal: ${unitData.dateHeaders.map(h => h.shortLabel).join(', ')}</p>
            </div>
            <div class="text-xs text-slate-300">Jumlah pekerja: <span class="font-semibold text-white">${fmtInt(unitData.workers.length)}</span></div>
          </div>
        </div>
        <div class="overflow-auto">
          <table class="min-w-full text-sm">
            <thead class="bg-slate-900/90 sticky top-0">
              <tr>
                <th class="px-3 py-2 text-center">Div</th>
                <th class="px-3 py-2 text-left">NIK</th>
                <th class="px-3 py-2 text-left">Nama</th>
                ${tableHead}
                <th class="px-3 py-2 text-right">Rerata</th>
              </tr>
            </thead>
            <tbody>${body}</tbody>
          </table>
        </div>
      </section>
    `;
  }).join('');
}

function renderMatrices() {
  el.matrixProdWrap.innerHTML = renderMatrixTables('prod');
  el.matrixAbsWrap.innerHTML = renderMatrixTables('abs');
}

function buildDateRangeInclusive(startDate, endDate) {
  const list = [];
  const cur = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
  while (cur <= end) {
    list.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return list;
}

function findHeaderIndex(headers, names) {
  const normalized = headers.map(h => normalizeHeaderName(h).toLowerCase());
  for (const name of names) {
    const idx = normalized.indexOf(normalizeHeaderName(name).toLowerCase());
    if (idx >= 0) return idx;
  }
  return -1;
}

function parsePremiText(text, fileName) {
  const unit = inferUnitName(fileName);
  const lines = text.replace(/\r/g, '').split('\n');
  const nonEmptyHeaderIdx = lines.findIndex(line => line.includes('Nama Pekerja') && line.includes('Tanggal') && line.includes('Basis Proporsi 1'));
  if (nonEmptyHeaderIdx < 0) {
    throw new Error(`Header kolom tidak ditemukan pada file ${fileName}`);
  }

  const headerMain = lines[nonEmptyHeaderIdx].split('	').map(normalizeHeaderName);
  const nameIdx = findHeaderIndex(headerMain, ['Nama Pekerja']);
  const dateIdx = findHeaderIndex(headerMain, ['Tanggal']);
  if (nameIdx < 0 || dateIdx < 0) {
    throw new Error(`Kolom wajib (Nama Pekerja/Tanggal) tidak ditemukan pada file ${fileName}`);
  }

  let i = nonEmptyHeaderIdx + 2;
  const rows = [];
  while (i < lines.length) {
    const line = lines[i] || '';
    const trimmed = line.trim();
    if (!trimmed) {
      i += 1;
      continue;
    }

    const parts = line.split('	');
    const candidateDate = normalizeHeaderName(parts[dateIdx] || '');
    const candidateName = normalizeHeaderName(parts[nameIdx] || '');
    const isDataRow = parseIDDate(candidateDate) && candidateName;
    if (!isDataRow) {
      i += 1;
      continue;
    }

    const row = {};
    for (let c = 0; c < headerMain.length; c++) {
      const key = normalizeHeaderName(headerMain[c]);
      if (!key) continue;
      row[key] = normalizeHeaderName(parts[c] || '');
    }

    row.__unit = unit;
    row.__fileName = fileName;
    rows.push(row);

    // Beberapa file memiliki baris lanjutan tanpa tanggal pada baris berikutnya.
    // Jika ditemukan, cukup lewati karena field yang dipakai untuk skoring
    // sudah berada di baris utama.
    const nextLine = lines[i + 1] || '';
    const nextParts = nextLine.split('	');
    const nextDate = normalizeHeaderName(nextParts[dateIdx] || '');
    const nextLooksContinuation = nextLine.trim() && !parseIDDate(nextDate);
    i += nextLooksContinuation ? 2 : 1;
  }

  const dates = rows.map(r => parseIDDate(r['Tanggal'])).filter(Boolean);
  if (!dates.length) throw new Error(`Tidak ada data tanggal valid pada file ${fileName}`);

  const byWorkerDate = new Map();
  const workers = new Map();

  for (const r of rows) {
    const d = parseIDDate(r['Tanggal']);
    if (!d) continue;
    const dateISO = toISO(d);
    const nip = String(r['NIP'] || '').trim();
    const nama = String(r['Nama Pekerja'] || '').trim();
    if (!nama && !nip) continue;

    const wKey = `${unit}__${nip}__${nama}`;
    workers.set(wKey, {
      unit,
      nip,
      nama,
      fileName,
      unitAsalPekerja: r['Unit Asal Pekerja'] || '',
      employee: r['Employee'] || '',
      divisi: r['Divisi'] || ''
    });

    const wdKey = `${wKey}__${dateISO}`;
    if (!byWorkerDate.has(wdKey)) {
      byWorkerDate.set(wdKey, {
        unit,
        fileName,
        dateISO,
        dateDisplay: d.toLocaleDateString('id-ID'),
        monthKey: monthKeyFromDate(d),
        nip,
        nama,
        unitAsalPekerja: r['Unit Asal Pekerja'] || '',
        employee: r['Employee'] || '',
        divisi: r['Divisi'] || '',
        attendanceScore: 5,
        quantity: 0,
        quantityJjg: 0,
        basisProrata: 0,
        basis1Total: 0,
        sourceRows: 0
      });
    }
    const agg = byWorkerDate.get(wdKey);
    agg.sourceRows += 1;

    const basis1 = parseDec(r['Basis 1']);
    const basisProrata1 = parseDec(r['Basis Proporsi 1']);
    if (basis1 > 0) {
      agg.quantity += parseDec(r['Quantity']);
      agg.quantityJjg += parseDec(r['Quantity (Jjg)']);
      agg.basisProrata += basisProrata1;
      agg.basis1Total += basis1;
    }
  }

  const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
  const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
  const allDates = buildDateRangeInclusive(minDate, maxDate);

  const dailyRows = [];
  for (const worker of workers.values()) {
    for (const dateObj of allDates) {
      const dateISO = toISO(dateObj);
      const wdKey = `${worker.unit}__${worker.nip}__${worker.nama}__${dateISO}`;
      const existing = byWorkerDate.get(wdKey);
      if (existing) {
        const pct = existing.basisProrata > 0 ? (existing.quantity / existing.basisProrata) * 100 : 0;
        existing.productivityPct = pct;
        existing.productivityScore = existing.basisProrata > 0 ? productivityScore(pct) : 0;
        dailyRows.push(existing);
      } else {
        dailyRows.push({
          unit: worker.unit,
          fileName,
          dateISO,
          dateDisplay: dateObj.toLocaleDateString('id-ID'),
          monthKey: monthKeyFromDate(dateObj),
          nip: worker.nip,
          nama: worker.nama,
          unitAsalPekerja: worker.unitAsalPekerja,
          employee: worker.employee,
          divisi: worker.divisi,
          attendanceScore: 0,
          quantity: 0,
          quantityJjg: 0,
          basisProrata: 0,
          basis1Total: 0,
          sourceRows: 0,
          productivityPct: 0,
          productivityScore: 0
        });
      }
    }
  }

  dailyRows.sort((a, b) => a.dateISO.localeCompare(b.dateISO) || a.nama.localeCompare(b.nama) || a.nip.localeCompare(b.nip));
  return {
    unit,
    fileName,
    minDate: toISO(minDate),
    maxDate: toISO(maxDate),
    rawRows: rows.length,
    workerCount: workers.size,
    dailyRows
  };
}

async function readFileAsText(file) {
  const buffer = await file.arrayBuffer();
  const decoder = new TextDecoder('latin1');
  return decoder.decode(buffer);
}

async function processSelectedFiles() {
  const files = Array.from(el.fileInput.files || []);
  if (!files.length) {
    alert('Silakan pilih file terlebih dahulu.');
    return;
  }
  showLoading('Membaca file dan menghitung skoring...');
  try {
    state.uploadedFiles = [];
    state.parsedFiles = [];
    state.dailyRows = [];
    for (let idx = 0; idx < files.length; idx++) {
      const file = files[idx];
      el.loadingText.textContent = `Memproses ${idx + 1} / ${files.length}: ${file.name}`;
      const text = await readFileAsText(file);
      const parsed = parsePremiText(text, file.name);

      state.uploadedFiles.push({
        id: `${file.name}__${file.lastModified}__${file.size}`,
        name: file.name,
        size: file.size,
        lastModified: file.lastModified
      });
      state.parsedFiles.push(parsed);
      state.dailyRows.push(...parsed.dailyRows);

      await idbPut(STORE_FILES, {
        id: `${file.name}__${file.lastModified}__${file.size}`,
        name: file.name,
        size: file.size,
        lastModified: file.lastModified,
        rawText: text
      });
    }
    state.dailyRows.sort((a, b) => a.unit.localeCompare(b.unit) || a.dateISO.localeCompare(b.dateISO) || a.nama.localeCompare(b.nama));
    populateFilters();
    applyFilters();
    await saveStateToDb();
    alert('File berhasil diproses.');
  } catch (err) {
    console.error(err);
    alert(`Gagal memproses file: ${err.message || err}`);
  } finally {
    hideLoading();
  }
}

async function rebuildFromStoredFiles() {
  const files = await idbGetAll(STORE_FILES);
  if (!files.length) return;
  showLoading('Memuat data lokal dari IndexedDB...');
  try {
    state.uploadedFiles = files.map(f => ({ id: f.id, name: f.name, size: f.size, lastModified: f.lastModified }));
    state.parsedFiles = [];
    state.dailyRows = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      el.loadingText.textContent = `Membangun ulang ${i + 1} / ${files.length}: ${f.name}`;
      const parsed = parsePremiText(f.rawText, f.name);
      state.parsedFiles.push(parsed);
      state.dailyRows.push(...parsed.dailyRows);
    }
    state.dailyRows.sort((a, b) => a.unit.localeCompare(b.unit) || a.dateISO.localeCompare(b.dateISO) || a.nama.localeCompare(b.nama));
    populateFilters();
    applyFilters();
  } catch (err) {
    console.error(err);
    alert(`Gagal memuat data lokal: ${err.message || err}`);
  } finally {
    hideLoading();
  }
}

function autoFitColumns(ws, widths = []) {
  widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
}

function styleHeaderRow(row) {
  row.eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
    };
  });
}
function scoreFill(score) {
  const s = Number(score || 0);
  if (s >= 5) return 'FF166534';
  if (s >= 4) return 'FF16A34A';
  if (s >= 3) return 'FFEAB308';
  if (s >= 2) return 'FFF97316';
  return 'FFDC2626';
}
function applyScoreStyle(cell, score) {
  cell.font = { bold: true, color: { argb: (Number(score) >= 3 ? 'FF111827' : 'FFFFFFFF') } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: scoreFill(score) } };
  cell.alignment = { horizontal: 'center' };
}
function styleDataBorders(ws) {
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    row.eachCell(cell => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };
      if (typeof cell.value === 'number') cell.alignment = { horizontal: 'right' };
    });
  });
}
function safeSheetName(name) {
  return String(name).replace(/[\\/?*\[\]:]/g, ' ').slice(0, 31);
}

function makeSheetName(prefix, unit) {
  return safeSheetName(`${prefix} ${unit}`);
}

function writeMatrixWorksheet(wb, prefix, unitData, valueKey, avgKey) {
  const ws = wb.addWorksheet(makeSheetName(prefix, unitData.unit), { views: [{ state: 'frozen', xSplit: 3, ySplit: 2 }] });
  const title = prefix === 'MProd' ? 'MATRIK SKOR PRODUKTIVITAS' : 'MATRIK SKOR KEHADIRAN';
  const lastCol = 4 + unitData.dateHeaders.length;
  ws.mergeCells(1, 1, 1, lastCol);
  ws.getCell(1, 1).value = `${title} - ${unitData.unit}`;
  ws.getCell(1, 1).font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
  ws.getCell(1, 1).alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getCell(1, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };

  const header1 = ['Div', 'NIK', 'Nama', ...unitData.dateHeaders.map(h => Number(h.dayLabel)), 'Rerata'];
  const row = ws.addRow(header1);
  styleHeaderRow(row);

  for (const worker of unitData.workers) {
    const excelRow = ws.addRow([worker.divisi || '', worker.nip || '', worker.nama || '', ...worker[valueKey], Number(worker[avgKey])]);
    for (let c = 1; c <= lastCol; c++) {
      excelRow.getCell(c).border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };
    }
    for (let c = 4; c < 4 + unitData.dateHeaders.length; c++) {
      applyScoreStyle(excelRow.getCell(c), excelRow.getCell(c).value);
    }
    excelRow.getCell(4 + unitData.dateHeaders.length).numFmt = '0.00';
    excelRow.getCell(4 + unitData.dateHeaders.length).alignment = { horizontal: 'right' };
  }

  autoFitColumns(ws, [8, 14, 30].concat(Array(unitData.dateHeaders.length).fill(6), [10]));
}

async function downloadWorkbook() {
  if (!state.filteredRows.length) {
    alert('Belum ada data untuk di-download.');
    return;
  }
  if (typeof ExcelJS === 'undefined') {
    alert('Library ExcelJS tidak berhasil dimuat. Pastikan koneksi internet aktif saat membuka aplikasi ini.');
    return;
  }

  showLoading('Membuat file Excel...');
  try {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'ChatGPT';
    wb.created = new Date();

    const wsUnit = wb.addWorksheet('Rekap Unit', { views: [{ state: 'frozen', ySplit: 1 }] });
    wsUnit.addRow(['Unit', 'HK', 'Jumlah Pekerja', 'Rata-rata Skor Produktivitas', 'Rata-rata Skor Absensi']);
    styleHeaderRow(wsUnit.getRow(1));
    for (const r of state.unitRecap) {
      wsUnit.addRow([r.unit, r.hk, r.workers, Number(r.avgProd), Number(r.avgAbs)]);
    }
    autoFitColumns(wsUnit, [18, 12, 16, 24, 20]);
    styleDataBorders(wsUnit);

    const wsWorker = wb.addWorksheet('Rekap Tenaga Kerja', { views: [{ state: 'frozen', ySplit: 1 }] });
    wsWorker.addRow(['Unit', 'NIP', 'Nama Pekerja', 'HK', 'Rata-rata Skor Produktivitas', 'Rata-rata Skor Absensi']);
    styleHeaderRow(wsWorker.getRow(1));
    for (const r of state.workerRecap) {
      wsWorker.addRow([r.unit, r.nip, r.nama, r.hk, Number(r.avgProd), Number(r.avgAbs)]);
    }
    autoFitColumns(wsWorker, [16, 14, 28, 10, 24, 20]);
    styleDataBorders(wsWorker);

    const byUnit = new Map();
    for (const row of state.filteredRows) {
      if (!byUnit.has(row.unit)) byUnit.set(row.unit, []);
      byUnit.get(row.unit).push(row);
    }

    for (const unitData of state.unitMatrices) {
      writeMatrixWorksheet(wb, 'MProd', unitData, 'prodValues', 'avgProd');
      writeMatrixWorksheet(wb, 'MAbs', unitData, 'absValues', 'avgAbs');
    }

    for (const [unit, rows] of byUnit.entries()) {
      const ws = wb.addWorksheet(safeSheetName(unit), { views: [{ state: 'frozen', ySplit: 1 }] });
      ws.addRow([
        'Unit', 'Tanggal', 'Bulan', 'NIP', 'Nama Pekerja',
        'Qty', 'Qty (Jjg)', 'Basis 1 Total', 'Basis Prorata',
        '% Basis', 'Skor Produktivitas', 'Skor Absensi',
        'Unit Asal Pekerja', 'Employee', 'Divisi', 'Nama File'
      ]);
      styleHeaderRow(ws.getRow(1));

      rows.forEach(r => {
        const row = ws.addRow([
          r.unit, r.dateDisplay, r.monthKey, r.nip, r.nama,
          Number(r.quantity), Number(r.quantityJjg), Number(r.basis1Total), Number(r.basisProrata),
          Number(r.productivityPct / 100), Number(r.productivityScore), Number(r.attendanceScore),
          r.unitAsalPekerja, r.employee, r.divisi, r.fileName
        ]);
        row.getCell(6).numFmt = '#,##0.00';
        row.getCell(7).numFmt = '#,##0.00';
        row.getCell(8).numFmt = '#,##0.00';
        row.getCell(9).numFmt = '#,##0.00';
        row.getCell(10).numFmt = '0.00%';
        applyScoreStyle(row.getCell(11), r.productivityScore);
        applyScoreStyle(row.getCell(12), r.attendanceScore);
      });

      autoFitColumns(ws, [14, 14, 12, 14, 28, 14, 12, 14, 14, 12, 16, 12, 18, 14, 12, 20]);
      styleDataBorders(ws);
    }

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const a = document.createElement('a');
    const now = new Date();
    const stamp = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;
    a.href = URL.createObjectURL(blob);
    a.download = `skoring_premi_panen_${stamp}.xlsx`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 1000);
  } catch (err) {
    console.error(err);
    alert(`Gagal membuat file Excel: ${err.message || err}`);
  } finally {
    hideLoading();
  }
}

async function clearLocalData() {
  const yes = confirm('Yakin ingin menghapus seluruh data lokal aplikasi ini?');
  if (!yes) return;
  showLoading('Menghapus data lokal...');
  try {
    await idbDeleteDatabase();
    state.uploadedFiles = [];
    state.parsedFiles = [];
    state.dailyRows = [];
    state.filteredRows = [];
    state.unitRecap = [];
    state.workerRecap = [];
    state.unitMatrices = [];
    state.filters = { month: '', unit: '', dateFrom: '', dateTo: '', q: '' };
    el.fileInput.value = '';
    populateFilters();
    renderAll();
    alert('Data lokal berhasil dihapus.');
  } catch (err) {
    console.error(err);
    alert(`Gagal menghapus data lokal: ${err.message || err}`);
  } finally {
    hideLoading();
  }
}

function wireEvents() {
  el.fileInput.addEventListener('change', () => {
    const files = Array.from(el.fileInput.files || []);
    if (!files.length) {
      renderSelectedFiles();
      return;
    }
    state.uploadedFiles = files.map(file => ({
      id: `${file.name}__${file.lastModified}__${file.size}`,
      name: file.name,
      size: file.size,
      lastModified: file.lastModified
    }));
    renderSelectedFiles();
  });
  el.btnProcess.addEventListener('click', processSelectedFiles);
  el.btnDownload.addEventListener('click', downloadWorkbook);
  el.btnClear.addEventListener('click', clearLocalData);
  el.btnApplyFilter.addEventListener('click', applyFilters);
  el.btnResetFilter.addEventListener('click', () => {
    state.filters = { month: '', unit: '', dateFrom: '', dateTo: '', q: '' };
    populateFilters();
    applyFilters();
  });
  el.searchInput.addEventListener('input', () => applyFilters());
}

async function boot() {
  showLoading('Memulai aplikasi...');
  try {
    wireEvents();
    await loadStateFromDb();
    renderSelectedFiles();
    if (!state.dailyRows.length) {
      await rebuildFromStoredFiles();
    } else {
      populateFilters();
      applyFilters();
    }
  } catch (err) {
    console.error(err);
    alert(`Gagal memulai aplikasi: ${err.message || err}`);
  } finally {
    hideLoading();
  }
}
boot();
