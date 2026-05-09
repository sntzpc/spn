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
  compareRows: [],
  compareFilteredRows: [],
  compareRawBhpRows: [],
  compareRawPremiRows: [],
  compareFiles: { bhp: null, premi: null },
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
  loadingText: document.getElementById('loadingText'),
  bhpCompareInput: document.getElementById('bhpCompareInput'),
  premiCompareInput: document.getElementById('premiCompareInput'),
  bhpCompareInfo: document.getElementById('bhpCompareInfo'),
  premiCompareInfo: document.getElementById('premiCompareInfo'),
  btnRunCompare: document.getElementById('btnRunCompare'),
  btnDownloadCompare: document.getElementById('btnDownloadCompare'),
  compareStats: document.getElementById('compareStats'),
  compareBrondolBody: document.getElementById('compareBrondolBody'),
  compareJanjangBody: document.getElementById('compareJanjangBody'),
  compareDetailBody: document.getElementById('compareDetailBody'),
  compareSearchInput: document.getElementById('compareSearchInput'),
  compareFoot: document.getElementById('compareFoot')
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

function parseISODateOnly(dateISO) {
  const m = String(dateISO || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(d.getTime()) ? null : d;
}
function isWorkdayMonToSat(dateISO) {
  const d = parseISODateOnly(dateISO);
  if (!d) return false;
  const day = d.getDay(); // 0=Minggu, 1=Senin, ..., 6=Sabtu
  return day >= 1 && day <= 6;
}
function isProductivityCountable(row) {
  return Number(row?.productivityScore || 0) > 0;
}
function isAttendanceCountable(row) {
  if (!row) return false;
  if (typeof row.attendanceCountable === 'boolean') return row.attendanceCountable;
  return Number(row.attendanceScore || 0) > 0;
}
function avgProductivityScoreFromValues(values) {
  const valid = (values || []).map(v => Number(v || 0)).filter(v => v > 0);
  return valid.length ? valid.reduce((sum, v) => sum + v, 0) / valid.length : 0;
}
function avgAttendanceScoreFromValues(values, dateList, firstActiveDateISO) {
  if (!values || !values.length) return 0;
  const valid = [];
  for (let i = 0; i < values.length; i++) {
    const score = Number(values[i] || 0);
    const dateISO = dateList?.[i] || '';
    const countable = score > 0 || (firstActiveDateISO && dateISO >= firstActiveDateISO && isWorkdayMonToSat(dateISO));
    if (countable) valid.push(score);
  }
  return valid.length ? valid.reduce((sum, v) => sum + v, 0) / valid.length : 0;
}
function normalizeDailyRowsForScoring(rows) {
  const firstActiveByWorker = new Map();
  for (const row of rows || []) {
    if (Number(row.attendanceScore || 0) <= 0) continue;
    const key = `${row.unit || ''}__${row.nip || ''}__${row.nama || ''}`;
    const dateISO = String(row.dateISO || '');
    if (!dateISO) continue;
    const prev = firstActiveByWorker.get(key);
    if (!prev || dateISO < prev) firstActiveByWorker.set(key, dateISO);
  }
  for (const row of rows || []) {
    const key = `${row.unit || ''}__${row.nip || ''}__${row.nama || ''}`;
    const firstActiveDateISO = firstActiveByWorker.get(key) || '';
    row.productivityCountable = isProductivityCountable(row);
    row.firstActiveDateISO = firstActiveDateISO;
    row.attendanceCountable = Number(row.attendanceScore || 0) > 0
      || Boolean(firstActiveDateISO && String(row.dateISO || '') >= firstActiveDateISO && isWorkdayMonToSat(row.dateISO));
  }
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
  normalizeDailyRowsForScoring(state.filteredRows);

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
        prodCount: 0,
        absCount: 0
      });
    }
    const u = unitMap.get(uKey);
    u.hk += 1;
    u.workerSet.add(row.nip || row.nama);
    if (isProductivityCountable(row)) {
      u.prodSum += Number(row.productivityScore || 0);
      u.prodCount += 1;
    }
    if (isAttendanceCountable(row)) {
      u.absSum += Number(row.attendanceScore || 0);
      u.absCount += 1;
    }

    const wKey = `${row.unit}__${row.nip}__${row.nama}`;
    if (!workerMap.has(wKey)) {
      workerMap.set(wKey, {
        unit: row.unit,
        nip: row.nip,
        nama: row.nama,
        hk: 0,
        prodSum: 0,
        absSum: 0,
        prodCount: 0,
        absCount: 0
      });
    }
    const w = workerMap.get(wKey);
    w.hk += 1;
    if (isProductivityCountable(row)) {
      w.prodSum += Number(row.productivityScore || 0);
      w.prodCount += 1;
    }
    if (isAttendanceCountable(row)) {
      w.absSum += Number(row.attendanceScore || 0);
      w.absCount += 1;
    }
  }

  state.unitRecap = Array.from(unitMap.values()).map(v => ({
    unit: v.unit,
    hk: v.hk,
    workers: v.workerSet.size,
    avgProd: v.prodCount ? v.prodSum / v.prodCount : 0,
    avgAbs: v.absCount ? v.absSum / v.absCount : 0
  })).sort((a, b) => a.unit.localeCompare(b.unit));

  state.workerRecap = Array.from(workerMap.values()).map(v => ({
    unit: v.unit,
    nip: v.nip,
    nama: v.nama,
    hk: v.hk,
    avgProd: v.prodCount ? v.prodSum / v.prodCount : 0,
    avgAbs: v.absCount ? v.absSum / v.absCount : 0
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
          absByDate: {},
          firstActiveDateISO: row.firstActiveDateISO || ''
        });
      }
      const item = workerMap.get(key);
      item.prodByDate[row.dateISO] = Number(row.productivityScore || 0);
      item.absByDate[row.dateISO] = Number(row.attendanceScore || 0);
      if (Number(row.attendanceScore || 0) > 0) {
        item.firstActiveDateISO = !item.firstActiveDateISO || row.dateISO < item.firstActiveDateISO ? row.dateISO : item.firstActiveDateISO;
      }
    }

    const workers = Array.from(workerMap.values()).map(item => {
      const prodValues = dateList.map(d => Number(item.prodByDate[d] || 0));
      const absValues = dateList.map(d => Number(item.absByDate[d] || 0));
      return {
        ...item,
        prodValues,
        absValues,
        avgProd: avgProductivityScoreFromValues(prodValues),
        avgAbs: avgAttendanceScoreFromValues(absValues, dateList, item.firstActiveDateISO)
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
  normalizeDailyRowsForScoring(state.filteredRows);
  const prodScores = state.filteredRows.map(r => Number(r.productivityScore || 0)).filter(v => v > 0);
  const avgProd = prodScores.length ? prodScores.reduce((sum, v) => sum + v, 0) / prodScores.length : 0;
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
    const prevWorker = workers.get(wKey);
    workers.set(wKey, {
      unit,
      nip,
      nama,
      fileName,
      unitAsalPekerja: r['Unit Asal Pekerja'] || '',
      employee: r['Employee'] || '',
      divisi: r['Divisi'] || '',
      firstActiveDateISO: prevWorker?.firstActiveDateISO && prevWorker.firstActiveDateISO < dateISO ? prevWorker.firstActiveDateISO : dateISO
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
        existing.productivityCountable = existing.productivityScore > 0;
        existing.firstActiveDateISO = worker.firstActiveDateISO || dateISO;
        existing.attendanceCountable = true;
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
          productivityScore: 0,
          productivityCountable: false,
          firstActiveDateISO: worker.firstActiveDateISO || '',
          attendanceCountable: Boolean(worker.firstActiveDateISO && dateISO >= worker.firstActiveDateISO && isWorkdayMonToSat(dateISO))
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



// =========================
// PERBANDINGAN BHP VS PREMI
// =========================
function normalizeCompareText(value) {
  return String(value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}
function normalizeNip(value) {
  const s = normalizeCompareText(value);
  return s.replace(/^0+(?=\d)/, '') || s;
}
function normalizeBlock(value) {
  return normalizeCompareText(value).toUpperCase();
}
function normalizeDivisiValue(value) {
  const s = normalizeCompareText(value);
  if (!s) return '';
  const m = s.match(/\d+/);
  return m ? String(Number(m[0])) : s.toUpperCase();
}
function divisiFromKemandoran(value) {
  const s = normalizeCompareText(value);
  const m = s.match(/\d{2}/);
  if (!m) return '';
  const code = Number(m[0]);
  // Kode kemandoran 11 = Divisi 1, 12 = Divisi 2, 13 = Divisi 3, dst.
  if (code >= 11) return String(code - 10);
  return String(code);
}
function pickCompareDivisi(row) {
  const bhp = normalizeDivisiValue(row?.bhpDivisi);
  const premi = normalizeDivisiValue(row?.premiDivisi);
  return bhp || premi || '';
}
function compareKey(unit, dateISO, nip, nama, blok) {
  return [normalizeCompareText(unit).toUpperCase(), dateISO || '', normalizeNip(nip), normalizeCompareText(nama).toUpperCase(), normalizeBlock(blok)].join('__');
}
function findHeaderLine(lines, requiredWords) {
  return lines.findIndex(line => requiredWords.every(w => line.toLowerCase().includes(String(w).toLowerCase())));
}
function sumPremiRpFromRow(row) {
  let total = parseDec(row['Rp. Total Premi']);
  if (total > 0) return total;
  for (let i = 1; i <= 5; i++) {
    total += parseDec(row[`Rp. Siap Borong ${i}`]);
    total += parseDec(row[`Rp. Lebih Borong ${i}`]);
  }
  return total;
}
function ensureCompareAgg(map, base) {
  const key = compareKey(base.unit, base.dateISO, base.nip, base.nama, base.blok);
  if (!map.has(key)) {
    map.set(key, {
      key,
      unit: normalizeCompareText(base.unit).toUpperCase(),
      dateISO: base.dateISO || '',
      dateDisplay: base.dateDisplay || '',
      nip: normalizeNip(base.nip),
      nama: normalizeCompareText(base.nama).toUpperCase(),
      blok: normalizeBlock(base.blok),
      bhpDivisi: normalizeDivisiValue(base.bhpDivisi || base.divisi || ''),
      premiDivisi: normalizeDivisiValue(base.premiDivisi || base.divisi || ''),
      divisi: normalizeDivisiValue(base.divisi || base.bhpDivisi || base.premiDivisi || ''),
      bhpBrondol: 0,
      bhpJanjang: 0,
      bhpPctAktualSum: 0,
      bhpPctHitungSum: 0,
      bhpPctCount: 0,
      premiBrondol: 0,
      premiJanjang: 0,
      premiBrondolRp: 0,
      premiJanjangRp: 0,
      bhpRows: 0,
      premiRows: 0
    });
  }
  return map.get(key);
}
function parseBHPCompareText(text, fileName) {
  const lines = text.replace(/\r/g, '').split('\n');
  const headerIdx = findHeaderLine(lines, ['Unit Lokasi Kerja', 'KG Brondol', 'Janjang Netto']);
  if (headerIdx < 0) throw new Error(`Header BHP tidak ditemukan pada file ${fileName}`);
  const headers = lines[headerIdx].split('\t').map(normalizeHeaderName);
  const idx = {
    unit: findHeaderIndex(headers, ['Unit Lokasi Kerja', 'Unit']),
    date: findHeaderIndex(headers, ['Tgl', 'Tanggal']),
    kemandoran: findHeaderIndex(headers, ['Kemandoran']),
    nip: findHeaderIndex(headers, ['NIP']),
    nama: findHeaderIndex(headers, ['Nama', 'Nama Pekerja']),
    blok: findHeaderIndex(headers, ['BLOK', 'Blok']),
    brondol: findHeaderIndex(headers, ['KG Brondol', 'Kg Brondol']),
    janjang: findHeaderIndex(headers, ['Janjang Netto', 'Janjang Net']),
    pctAktual: findHeaderIndex(headers, ['% Brondol Aktual']),
    pctHitung: findHeaderIndex(headers, ['% Brondol Perhitungan'])
  };
  const required = ['unit', 'date', 'nip', 'nama', 'blok', 'brondol', 'janjang'];
  const missing = required.filter(k => idx[k] < 0);
  if (missing.length) throw new Error(`Kolom BHP belum lengkap: ${missing.join(', ')}`);

  const map = new Map();
  const rawRows = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const parts = lines[i].split('\t');
    const d = parseIDDate(parts[idx.date]);
    if (!d) continue;
    const unit = normalizeCompareText(parts[idx.unit]);
    const divisi = idx.kemandoran >= 0 ? divisiFromKemandoran(parts[idx.kemandoran]) : '';
    const nip = normalizeNip(parts[idx.nip]);
    const nama = normalizeCompareText(parts[idx.nama]);
    const blok = normalizeBlock(parts[idx.blok]);
    if (!unit || (!nip && !nama) || !blok) continue;
    const dateISO = toISO(d);
    const dateDisplay = d.toLocaleDateString('id-ID');
    const kgBrondol = parseDec(parts[idx.brondol]);
    const janjangNetto = parseDec(parts[idx.janjang]);
    const pctAktual = idx.pctAktual >= 0 ? parseDec(parts[idx.pctAktual]) : 0;
    const pctHitung = idx.pctHitung >= 0 ? parseDec(parts[idx.pctHitung]) : 0;
    const agg = ensureCompareAgg(map, { unit, divisi, bhpDivisi: divisi, dateISO, dateDisplay, nip, nama, blok });
    if (divisi && !agg.bhpDivisi) agg.bhpDivisi = divisi;
    if (divisi && !agg.divisi) agg.divisi = divisi;
    agg.bhpBrondol += kgBrondol;
    agg.bhpJanjang += janjangNetto;
    agg.bhpRows += 1;
    if (pctAktual || pctHitung) {
      agg.bhpPctAktualSum += pctAktual;
      agg.bhpPctHitungSum += pctHitung;
      agg.bhpPctCount += 1;
    }
    rawRows.push({ fileName, unit, divisi, dateISO, dateDisplay, nip, nama, blok, kgBrondol, janjangNetto, pctAktual, pctHitung });
  }
  return { fileName, rows: Array.from(map.values()), rawRows };
}
function parsePremiCompareText(text, fileName) {
  const lines = text.replace(/\r/g, '').split('\n');
  const headerIdx = findHeaderLine(lines, ['Nama Pekerja', 'Tanggal', 'Quantity', 'Quantity (Jjg)']);
  if (headerIdx < 0) throw new Error(`Header Premi tidak ditemukan pada file ${fileName}`);
  const headers = lines[headerIdx].split('\t').map(normalizeHeaderName);
  const idx = {
    unit: findHeaderIndex(headers, ['Unit Asal Pekerja', 'Unit']),
    date: findHeaderIndex(headers, ['Tanggal', 'Tgl']),
    nip: findHeaderIndex(headers, ['NIP']),
    nama: findHeaderIndex(headers, ['Nama Pekerja', 'Nama']),
    divisi: findHeaderIndex(headers, ['Divisi']),
    blok: findHeaderIndex(headers, ['Blok', 'BLOK']),
    qty: findHeaderIndex(headers, ['Quantity']),
    qtyJjg: findHeaderIndex(headers, ['Quantity (Jjg)']),
    rpTotal: findHeaderIndex(headers, ['Rp. Total Premi'])
  };
  const required = ['unit', 'date', 'nip', 'nama', 'blok', 'qty', 'qtyJjg'];
  const missing = required.filter(k => idx[k] < 0);
  if (missing.length) throw new Error(`Kolom Premi belum lengkap: ${missing.join(', ')}`);

  const map = new Map();
  const rawRows = [];
  let i = headerIdx + 1;
  while (i < lines.length) {
    const parts = lines[i].split('\t');
    const d = parseIDDate(parts[idx.date]);
    if (!d) { i += 1; continue; }
    const row = {};
    for (let c = 0; c < headers.length; c++) {
      const key = headers[c];
      if (key) row[key] = normalizeHeaderName(parts[c] || '');
    }
    const unit = normalizeCompareText(parts[idx.unit]);
    const divisi = idx.divisi >= 0 ? normalizeDivisiValue(parts[idx.divisi]) : '';
    const nip = normalizeNip(parts[idx.nip]);
    const nama = normalizeCompareText(parts[idx.nama]);
    const blok = normalizeBlock(parts[idx.blok]);
    if (!unit || (!nip && !nama) || !blok) { i += 1; continue; }
    const dateISO = toISO(d);
    const dateDisplay = d.toLocaleDateString('id-ID');
    const qty = parseDec(parts[idx.qty]);
    const qtyJjg = parseDec(parts[idx.qtyJjg]);
    const rpTotal = sumPremiRpFromRow(row);
    const agg = ensureCompareAgg(map, { unit, divisi, premiDivisi: divisi, dateISO, dateDisplay, nip, nama, blok });
    if (divisi && !agg.premiDivisi) agg.premiDivisi = divisi;
    if (divisi && !agg.divisi) agg.divisi = divisi;
    if (qtyJjg > 0) {
      agg.premiJanjang += qtyJjg;
      agg.premiJanjangRp += rpTotal;
    } else {
      agg.premiBrondol += qty;
      agg.premiBrondolRp += rpTotal;
    }
    agg.premiRows += 1;
    rawRows.push({ fileName, unit, divisi, dateISO, dateDisplay, nip, nama, blok, quantity: qty, quantityJjg: qtyJjg, jenis: qtyJjg > 0 ? 'JANJANG' : 'BRONDOL', rpTotal });

    const nextLine = lines[i + 1] || '';
    const nextParts = nextLine.split('\t');
    const nextDate = idx.date >= 0 ? normalizeHeaderName(nextParts[idx.date] || '') : '';
    i += (nextLine.trim() && !parseIDDate(nextDate)) ? 2 : 1;
  }
  return { fileName, rows: Array.from(map.values()), rawRows };
}
function buildCompareRows(bhpParsed, premiParsed) {
  const map = new Map();
  for (const r of bhpParsed.rows) map.set(r.key, { ...r });
  for (const r of premiParsed.rows) {
    const cur = map.get(r.key) || { ...r, bhpBrondol: 0, bhpJanjang: 0, bhpPctAktualSum: 0, bhpPctHitungSum: 0, bhpPctCount: 0, bhpRows: 0 };
    if (r.premiDivisi && !cur.premiDivisi) cur.premiDivisi = r.premiDivisi;
    if (r.divisi && !cur.divisi) cur.divisi = r.divisi;
    cur.premiBrondol += r.premiBrondol || 0;
    cur.premiJanjang += r.premiJanjang || 0;
    cur.premiBrondolRp += r.premiBrondolRp || 0;
    cur.premiJanjangRp += r.premiJanjangRp || 0;
    cur.premiRows += r.premiRows || 0;
    map.set(r.key, cur);
  }
  return Array.from(map.values()).map(r => {
    const brondolRate = r.premiBrondol > 0 ? r.premiBrondolRp / r.premiBrondol : 0;
    const janjangRate = r.premiJanjang > 0 ? r.premiJanjangRp / r.premiJanjang : 0;
    const bhpBrondolRp = r.bhpBrondol * brondolRate;
    const bhpJanjangRp = r.bhpJanjang * janjangRate;
    const totalBhpRp = bhpBrondolRp + bhpJanjangRp;
    const totalPremiRp = r.premiBrondolRp + r.premiJanjangRp;
    return {
      ...r,
      divisi: pickCompareDivisi(r),
      pctAktualAvg: r.bhpPctCount ? r.bhpPctAktualSum / r.bhpPctCount : 0,
      pctHitungAvg: r.bhpPctCount ? r.bhpPctHitungSum / r.bhpPctCount : 0,
      brondolRate,
      janjangRate,
      selisihBrondol: r.bhpBrondol - r.premiBrondol,
      selisihJanjang: r.bhpJanjang - r.premiJanjang,
      bhpBrondolRp,
      bhpJanjangRp,
      selisihBrondolRp: bhpBrondolRp - r.premiBrondolRp,
      selisihJanjangRp: bhpJanjangRp - r.premiJanjangRp,
      totalBhpRp,
      totalPremiRp,
      totalSelisihRp: totalBhpRp - totalPremiRp,
      totalSelisihData: (r.bhpBrondol - r.premiBrondol) + (r.bhpJanjang - r.premiJanjang)
    };
  }).sort((a, b) => a.unit.localeCompare(b.unit) || String(a.divisi || '').localeCompare(String(b.divisi || ''), 'id') || a.dateISO.localeCompare(b.dateISO) || a.nama.localeCompare(b.nama) || a.blok.localeCompare(b.blok));
}
function fmtRp(n) {
  return Number(n || 0).toLocaleString('id-ID', { maximumFractionDigits: 2 });
}
function diffClass(n) {
  const x = Number(n || 0);
  if (x > 0) return 'text-emerald-700 font-bold';
  if (x < 0) return 'text-rose-700 font-bold';
  return 'text-slate-600';
}
function renderCompareStats(rows) {
  if (!el.compareStats) return;
  if (!rows.length) {
    el.compareStats.innerHTML = `<div class="col-span-full rounded-2xl bg-slate-50 border border-slate-200 p-4 text-slate-500 text-sm">Belum ada hasil perbandingan.</div>`;
    return;
  }
  const sum = rows.reduce((a, r) => {
    a.bhpBrondol += r.bhpBrondol; a.premiBrondol += r.premiBrondol;
    a.bhpJanjang += r.bhpJanjang; a.premiJanjang += r.premiJanjang;
    a.bhpRp += r.totalBhpRp; a.premiRp += r.totalPremiRp;
    return a;
  }, { bhpBrondol:0, premiBrondol:0, bhpJanjang:0, premiJanjang:0, bhpRp:0, premiRp:0 });
  const cards = [
    ['Brondol BHP', fmtNum(sum.bhpBrondol, 2)], ['Brondol Premi', fmtNum(sum.premiBrondol, 2)],
    ['Janjang BHP', fmtNum(sum.bhpJanjang, 2)], ['Janjang Premi', fmtNum(sum.premiJanjang, 2)],
    ['Selisih Data', fmtNum((sum.bhpBrondol-sum.premiBrondol)+(sum.bhpJanjang-sum.premiJanjang), 2)],
    ['Selisih Rp', fmtRp(sum.bhpRp - sum.premiRp)]
  ];
  el.compareStats.innerHTML = cards.map(([label, value]) => `<div class="rounded-2xl bg-slate-50 border border-slate-200 p-4"><div class="text-xs text-slate-500">${label}</div><div class="text-xl font-bold mt-1">${value}</div></div>`).join('');
}
function compareMatrixRow(r, type) {
  const isB = type === 'brondol';
  const bhp = isB ? r.bhpBrondol : r.bhpJanjang;
  const premi = isB ? r.premiBrondol : r.premiJanjang;
  const diff = isB ? r.selisihBrondol : r.selisihJanjang;
  const rpBhp = isB ? r.bhpBrondolRp : r.bhpJanjangRp;
  const rpPremi = isB ? r.premiBrondolRp : r.premiJanjangRp;
  const diffRp = isB ? r.selisihBrondolRp : r.selisihJanjangRp;
  return `<tr class="border-t border-slate-200"><td class="px-2 py-1">${escapeHtml(r.unit)}</td><td class="px-2 py-1">${escapeHtml(r.dateDisplay)}</td><td class="px-2 py-1">${escapeHtml(r.nip)}</td><td class="px-2 py-1 whitespace-nowrap">${escapeHtml(r.nama)}</td><td class="px-2 py-1">${escapeHtml(r.blok)}</td><td class="px-2 py-1 text-right">${fmtNum(bhp,2)}</td><td class="px-2 py-1 text-right">${fmtNum(premi,2)}</td><td class="px-2 py-1 text-right ${diffClass(diff)}">${fmtNum(diff,2)}</td><td class="px-2 py-1 text-right">${fmtRp(rpBhp)}</td><td class="px-2 py-1 text-right">${fmtRp(rpPremi)}</td><td class="px-2 py-1 text-right ${diffClass(diffRp)}">${fmtRp(diffRp)}</td></tr>`;
}
function renderCompareResults() {
  const q = normalizeKey(el.compareSearchInput?.value || '');
  const rows = q ? state.compareRows.filter(r => normalizeKey(`${r.unit} ${r.dateDisplay} ${r.nip} ${r.nama} ${r.blok}`).includes(q)) : state.compareRows;
  state.compareFilteredRows = rows;
  renderCompareStats(rows);
  if (!rows.length) {
    const empty = `<tr><td colspan="11" class="px-4 py-6 text-center text-slate-500">Belum ada data.</td></tr>`;
    if (el.compareBrondolBody) el.compareBrondolBody.innerHTML = empty;
    if (el.compareJanjangBody) el.compareJanjangBody.innerHTML = empty;
    if (el.compareDetailBody) el.compareDetailBody.innerHTML = `<tr><td colspan="16" class="px-4 py-6 text-center text-slate-500">Belum ada data.</td></tr>`;
    if (el.compareFoot) el.compareFoot.textContent = '';
    return;
  }
  const limited = rows.slice(0, 1000);
  el.compareBrondolBody.innerHTML = limited.map(r => compareMatrixRow(r, 'brondol')).join('');
  el.compareJanjangBody.innerHTML = limited.map(r => compareMatrixRow(r, 'janjang')).join('');
  el.compareDetailBody.innerHTML = limited.map(r => `<tr class="border-t border-slate-200"><td class="px-2 py-1">${escapeHtml(r.unit)}</td><td class="px-2 py-1">${escapeHtml(r.dateDisplay)}</td><td class="px-2 py-1">${escapeHtml(r.nip)}</td><td class="px-2 py-1 whitespace-nowrap">${escapeHtml(r.nama)}</td><td class="px-2 py-1">${escapeHtml(r.blok)}</td><td class="px-2 py-1 text-right">${fmtNum(r.bhpBrondol,2)}</td><td class="px-2 py-1 text-right">${fmtNum(r.premiBrondol,2)}</td><td class="px-2 py-1 text-right ${diffClass(r.selisihBrondol)}">${fmtNum(r.selisihBrondol,2)}</td><td class="px-2 py-1 text-right">${fmtNum(r.bhpJanjang,2)}</td><td class="px-2 py-1 text-right">${fmtNum(r.premiJanjang,2)}</td><td class="px-2 py-1 text-right ${diffClass(r.selisihJanjang)}">${fmtNum(r.selisihJanjang,2)}</td><td class="px-2 py-1 text-right">${fmtNum(r.pctAktualAvg,2)}</td><td class="px-2 py-1 text-right">${fmtNum(r.pctHitungAvg,2)}</td><td class="px-2 py-1 text-right">${fmtRp(r.totalBhpRp)}</td><td class="px-2 py-1 text-right">${fmtRp(r.totalPremiRp)}</td><td class="px-2 py-1 text-right ${diffClass(r.totalSelisihRp)}">${fmtRp(r.totalSelisihRp)}</td></tr>`).join('');
  el.compareFoot.textContent = `Menampilkan ${fmtInt(limited.length)} dari ${fmtInt(rows.length)} baris hasil perbandingan.`;
}
async function runCompareBhpPremi() {
  const bhpFile = el.bhpCompareInput?.files?.[0];
  const premiFile = el.premiCompareInput?.files?.[0];
  if (!bhpFile || !premiFile) {
    alert('Silakan pilih file BHP dan file Premi terlebih dahulu.');
    return;
  }
  showLoading('Membandingkan data BHP dan Premi...');
  try {
    const [bhpText, premiText] = await Promise.all([readFileAsText(bhpFile), readFileAsText(premiFile)]);
    const bhpParsed = parseBHPCompareText(bhpText, bhpFile.name);
    const premiParsed = parsePremiCompareText(premiText, premiFile.name);
    state.compareFiles = { bhp: bhpFile.name, premi: premiFile.name };
    state.compareRawBhpRows = bhpParsed.rawRows;
    state.compareRawPremiRows = premiParsed.rawRows;
    state.compareRows = buildCompareRows(bhpParsed, premiParsed);
    renderCompareResults();
    if (el.btnDownloadCompare) el.btnDownloadCompare.disabled = !state.compareRows.length;
    alert(`Perbandingan selesai. ${fmtInt(state.compareRows.length)} kombinasi Unit/Tanggal/NIP/Nama/Blok ditemukan.`);
  } catch (err) {
    console.error(err);
    alert(`Gagal menghitung perbandingan: ${err.message || err}`);
  } finally {
    hideLoading();
  }
}
function addCompareRowsToSheet(ws, rows, type) {
  const isB = type === 'brondol';
  ws.addRow(['Unit','Divisi','Tanggal','NIP','Nama','Blok','Data BHP','Data Premi','Selisih Data','Rp BHP','Rp Premi','Selisih Premi','Rate Premi']);
  styleHeaderRow(ws.getRow(1));
  for (const r of rows) {
    const row = ws.addRow([
      r.unit, r.divisi, r.dateDisplay, r.nip, r.nama, r.blok,
      isB ? r.bhpBrondol : r.bhpJanjang,
      isB ? r.premiBrondol : r.premiJanjang,
      isB ? r.selisihBrondol : r.selisihJanjang,
      isB ? r.bhpBrondolRp : r.bhpJanjangRp,
      isB ? r.premiBrondolRp : r.premiJanjangRp,
      isB ? r.selisihBrondolRp : r.selisihJanjangRp,
      isB ? r.brondolRate : r.janjangRate
    ]);
    [7,8,9,10,11,12,13].forEach(c => row.getCell(c).numFmt = '#,##0.00');
  }
  autoFitColumns(ws, [12,10,12,12,28,12,14,14,14,16,16,16,14]);
  styleDataBorders(ws);
}

function getCompareMonthInfo(rows) {
  const dates = rows.map(r => String(r.dateISO || '')).filter(v => /^\d{4}-\d{2}-\d{2}$/.test(v)).sort();
  const first = dates[0] || '';
  const year = first ? Number(first.slice(0, 4)) : new Date().getFullYear();
  const month = first ? Number(first.slice(5, 7)) : (new Date().getMonth() + 1);
  return {
    year,
    month,
    monthKey: `${year}-${String(month).padStart(2, '0')}`,
    daysInMonth: new Date(year, month, 0).getDate(),
    tag: `${String(year).slice(-2)}${String(month).padStart(2, '0')}`
  };
}
function pinkDiffFill() {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFD9E2' } };
}
function isNonZeroAmount(value) {
  return Math.abs(Number(value || 0)) > 0.000001;
}
function addComparePremiumMatrixSheet(wb, rows, type) {
  const isB = type === 'brondol';
  const monthInfo = getCompareMonthInfo(rows);
  const ws = wb.addWorksheet(isB ? 'Matrik Brondol' : 'Matrik Janjang', {
    views: [{ state: 'frozen', xSplit: 4, ySplit: 2 }]
  });
  const dayCount = monthInfo.daysInMonth;
  const totalCols = 4 + dayCount + 1;
  const title = `${isB ? 'MATRIK BRONDOL' : 'MATRIK JANJANG'} ${monthInfo.tag}`;

  ws.addRow([title]);
  ws.mergeCells(1, 1, 1, totalCols);
  const titleCell = ws.getCell(1, 1);
  titleCell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 20;

  const headers = ['Unit', 'Divisi', 'NIK', 'Nama'];
  for (let d = 1; d <= dayCount; d++) headers.push(String(d));
  headers.push('Total');
  ws.addRow(headers);
  styleHeaderRow(ws.getRow(2));

  const groupMap = new Map();
  for (const r of rows) {
    if (!String(r.dateISO || '').startsWith(monthInfo.monthKey)) continue;
    const key = [r.unit, r.divisi, r.nip, r.nama].map(v => normalizeCompareText(v).toUpperCase()).join('__');
    if (!groupMap.has(key)) {
      groupMap.set(key, {
        unit: r.unit,
        divisi: r.divisi,
        nip: r.nip,
        nama: r.nama,
        values: Array(dayCount).fill(0)
      });
    }
    const day = Number(String(r.dateISO).slice(8, 10));
    const amount = isB ? r.selisihBrondolRp : r.selisihJanjangRp;
    if (day >= 1 && day <= dayCount) groupMap.get(key).values[day - 1] += Number(amount || 0);
  }

  const matrixRows = Array.from(groupMap.values()).sort((a, b) =>
    String(a.unit || '').localeCompare(String(b.unit || ''), 'id') ||
    String(a.divisi || '').localeCompare(String(b.divisi || ''), 'id') ||
    String(a.nama || '').localeCompare(String(b.nama || ''), 'id') ||
    String(a.nip || '').localeCompare(String(b.nip || ''), 'id')
  );

  for (const item of matrixRows) {
    const total = item.values.reduce((sum, v) => sum + Number(v || 0), 0);
    const values = item.values.map(v => isNonZeroAmount(v) ? Number(v) : null);
    const row = ws.addRow([item.unit, item.divisi, item.nip, item.nama, ...values, total]);
    row.getCell(1).alignment = { horizontal: 'center' };
    row.getCell(2).alignment = { horizontal: 'center' };
    for (let c = 5; c <= totalCols; c++) {
      const cell = row.getCell(c);
      cell.numFmt = '#,##0.##';
      cell.alignment = { horizontal: 'right' };
      if (isNonZeroAmount(cell.value)) cell.fill = pinkDiffFill();
    }
  }

  autoFitColumns(ws, [12, 8, 12, 28, ...Array(dayCount).fill(10), 14]);
  ws.getColumn(4).alignment = { horizontal: 'left' };
  ws.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: totalCols } };
  ws.eachRow((row, rowNumber) => {
    row.eachCell({ includeEmpty: true }, cell => {
      cell.border = {
        top: { style: 'thin', color: { argb: rowNumber <= 2 ? 'FFFFFFFF' : 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: rowNumber <= 2 ? 'FFFFFFFF' : 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: rowNumber <= 2 ? 'FFFFFFFF' : 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: rowNumber <= 2 ? 'FFFFFFFF' : 'FFE2E8F0' } }
      };
    });
  });
  return ws;
}
async function downloadCompareWorkbook() {
  const rows = state.compareFilteredRows.length ? state.compareFilteredRows : state.compareRows;
  if (!rows.length) { alert('Belum ada hasil perbandingan untuk di-download.'); return; }
  if (typeof ExcelJS === 'undefined') { alert('Library ExcelJS tidak berhasil dimuat.'); return; }
  showLoading('Membuat file Excel perbandingan...');
  try {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'ChatGPT'; wb.created = new Date();
    const wsSummary = wb.addWorksheet('Ringkasan');
    wsSummary.addRow(['PERBANDINGAN DATA BHP VS PREMI']);
    wsSummary.mergeCells(1,1,1,6);
    wsSummary.getCell(1,1).font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
    wsSummary.getCell(1,1).fill = { type:'pattern', pattern:'solid', fgColor:{argb:'FF0F172A'} };
    wsSummary.getCell(1,1).alignment = { horizontal:'center' };
    wsSummary.addRow(['File BHP', state.compareFiles.bhp || '', '', 'File Premi', state.compareFiles.premi || '']);
    const sum = rows.reduce((a,r)=>{ a.bhpBrondol+=r.bhpBrondol; a.premiBrondol+=r.premiBrondol; a.bhpJanjang+=r.bhpJanjang; a.premiJanjang+=r.premiJanjang; a.bhpRp+=r.totalBhpRp; a.premiRp+=r.totalPremiRp; return a;}, {bhpBrondol:0,premiBrondol:0,bhpJanjang:0,premiJanjang:0,bhpRp:0,premiRp:0});
    wsSummary.addRow([]);
    wsSummary.addRow(['Item','BHP','Premi','Selisih']);
    styleHeaderRow(wsSummary.getRow(4));
    wsSummary.addRow(['Brondol', sum.bhpBrondol, sum.premiBrondol, sum.bhpBrondol-sum.premiBrondol]);
    wsSummary.addRow(['Janjang', sum.bhpJanjang, sum.premiJanjang, sum.bhpJanjang-sum.premiJanjang]);
    wsSummary.addRow(['Rupiah', sum.bhpRp, sum.premiRp, sum.bhpRp-sum.premiRp]);
    for (let r = 5; r <= 7; r++) for (let c = 2; c <= 4; c++) wsSummary.getRow(r).getCell(c).numFmt = '#,##0.00';
    autoFitColumns(wsSummary, [18,18,18,18,18,18]);
    styleDataBorders(wsSummary);

    // Urutan sheet: Ringkasan; Matrik Brondol; Rekap Brondol; Matrik Janjang; Rekap Janjang; Detail BHP; Detail Premi; Detail Gabungan.
    // Sheet matrik berisi akumulasi Selisih Premi per Unit/Divisi/NIK/Nama per tanggal.
    // Nilai yang memiliki selisih diberi arsiran pink, sedangkan nilai nol dibiarkan kosong/tanpa arsiran.
    addComparePremiumMatrixSheet(wb, rows, 'brondol');
    addCompareRowsToSheet(wb.addWorksheet('Rekap Brondol', { views: [{ state:'frozen', ySplit:1 }] }), rows, 'brondol');
    addComparePremiumMatrixSheet(wb, rows, 'janjang');
    addCompareRowsToSheet(wb.addWorksheet('Rekap Janjang', { views: [{ state:'frozen', ySplit:1 }] }), rows, 'janjang');

    const wsBhp = wb.addWorksheet('Detail BHP', { views: [{ state:'frozen', ySplit:1 }] });
    wsBhp.addRow(['Unit','Divisi','File','Tanggal','NIP','Nama','Blok','KG Brondol','Janjang Netto','% Brondol Aktual','% Brondol Perhitungan']);
    styleHeaderRow(wsBhp.getRow(1));
    state.compareRawBhpRows.forEach(r => wsBhp.addRow([r.unit,r.divisi,r.fileName,r.dateDisplay,r.nip,r.nama,r.blok,r.kgBrondol,r.janjangNetto,r.pctAktual,r.pctHitung]));
    autoFitColumns(wsBhp, [12,10,18,12,12,28,12,14,14,16,20]); styleDataBorders(wsBhp);

    const wsPremi = wb.addWorksheet('Detail Premi', { views: [{ state:'frozen', ySplit:1 }] });
    wsPremi.addRow(['Unit','Divisi','File','Tanggal','NIP','Nama','Blok','Jenis','Quantity','Quantity (Jjg)','Rp Total Premi']);
    styleHeaderRow(wsPremi.getRow(1));
    state.compareRawPremiRows.forEach(r => wsPremi.addRow([r.unit,r.divisi,r.fileName,r.dateDisplay,r.nip,r.nama,r.blok,r.jenis,r.quantity,r.quantityJjg,r.rpTotal]));
    autoFitColumns(wsPremi, [12,10,18,12,12,28,12,12,14,14,16]); styleDataBorders(wsPremi);

    const wsDetail = wb.addWorksheet('Detail Gabungan', { views: [{ state:'frozen', ySplit:1 }] });
    wsDetail.addRow(['Unit','Divisi','Tanggal','NIP','Nama','Blok','BHP Brondol','Premi Brondol','Selisih Brondol','BHP Janjang','Premi Janjang','Selisih Janjang','% Brondol Aktual','% Brondol Perhitungan','Rp BHP','Rp Premi','Selisih Rp','Total Selisih Data']);
    styleHeaderRow(wsDetail.getRow(1));
    rows.forEach(r => {
      const row = wsDetail.addRow([r.unit,r.divisi,r.dateDisplay,r.nip,r.nama,r.blok,r.bhpBrondol,r.premiBrondol,r.selisihBrondol,r.bhpJanjang,r.premiJanjang,r.selisihJanjang,r.pctAktualAvg,r.pctHitungAvg,r.totalBhpRp,r.totalPremiRp,r.totalSelisihRp,r.totalSelisihData]);
      for (let c=7;c<=18;c++) row.getCell(c).numFmt = '#,##0.00';
    });
    autoFitColumns(wsDetail, [12,10,12,12,28,12,14,14,14,14,14,14,14,16,16,16,16,16]);
    styleDataBorders(wsDetail);

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const a = document.createElement('a');
    const now = new Date();
    const stamp = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;
    a.href = URL.createObjectURL(blob);
    a.download = `perbandingan_bhp_premi_${stamp}.xlsx`;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  } catch (err) {
    console.error(err);
    alert(`Gagal membuat file Excel perbandingan: ${err.message || err}`);
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
  if (el.bhpCompareInput) el.bhpCompareInput.addEventListener('change', () => {
    const f = el.bhpCompareInput.files?.[0];
    el.bhpCompareInfo.textContent = f ? `${f.name} (${fmtInt(f.size)} byte)` : 'Belum ada file BHP dipilih.';
  });
  if (el.premiCompareInput) el.premiCompareInput.addEventListener('change', () => {
    const f = el.premiCompareInput.files?.[0];
    el.premiCompareInfo.textContent = f ? `${f.name} (${fmtInt(f.size)} byte)` : 'Belum ada file Premi dipilih.';
  });
  if (el.btnRunCompare) el.btnRunCompare.addEventListener('click', runCompareBhpPremi);
  if (el.btnDownloadCompare) el.btnDownloadCompare.addEventListener('click', downloadCompareWorkbook);
  if (el.compareSearchInput) el.compareSearchInput.addEventListener('input', renderCompareResults);
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
