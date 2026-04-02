(() => {
  'use strict';

  const DEFAULT_REMOTE = {
    gasUrl: 'https://script.google.com/macros/s/AKfycbxy-ERQsMybRvnEtsUIk_oEqDBUwfswEp74cWsjVhNzAYeLb3vEo23nnhSUiScWagfH/exec',
    sheetId: '1B6KmlUCOKGozN6abEhp7nzpJMMm1BylBA-tKIrGZBSA',
    defaultTheme: 'light'
  };
  const STORAGE_KEY = 'sp_app_v6';
  const THEME_KEY = 'sp_theme_v6';
  const ADMIN_USER = {
    id: 'USR-TC001', nip: 'TC001', name: 'ADMIN', role: 'ADMIN', estate: '', divisi: '', pin: '1234',
    active: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), synced: false
  };
  const DEFAULT_STATE = {
    settings: { ...DEFAULT_REMOTE },
    session: { isLoggedIn: false, userId: '', deviceId: '', loginAt: '', expiresAt: '' },
    users: [ADMIN_USER], estates: [], peserta: [], mentors: [], reports: [], meta: { lastBootstrapAt: '', lastPullAt: '', failedSyncQueue: [] }
  };

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const charts = {};
  let State = clone(DEFAULT_STATE);
  let dbReady = false;
  const LOGIN_TTL_MS = 3 * 24 * 60 * 60 * 1000;

  function clone(v){ return JSON.parse(JSON.stringify(v)); }
  function normalizeState(parsed){
    return {
      settings: { ...DEFAULT_REMOTE, ...((parsed && parsed.settings) || {}) },
      session: { ...DEFAULT_STATE.session, ...((parsed && parsed.session) || {}) },
      users: Array.isArray(parsed?.users) && parsed.users.length ? parsed.users : [clone(ADMIN_USER)],
      estates: Array.isArray(parsed?.estates) ? parsed.estates : [],
      peserta: Array.isArray(parsed?.peserta) ? parsed.peserta : [],
      mentors: Array.isArray(parsed?.mentors) ? parsed.mentors : [],
      reports: Array.isArray(parsed?.reports) ? parsed.reports : [],
      meta: { lastBootstrapAt:'', lastPullAt:'', failedSyncQueue: [], settingsDirty:false, ...((parsed && parsed.meta) || {}) }
    };
  }
  function openDb(){
    return new Promise((resolve,reject)=>{
      const req = indexedDB.open('sp_app_db_v4', 1);
      req.onupgradeneeded = ()=>{ const db=req.result; if(!db.objectStoreNames.contains('kv')) db.createObjectStore('kv'); };
      req.onsuccess = ()=> resolve(req.result);
      req.onerror = ()=> reject(req.error || new Error('Gagal membuka IndexedDB.'));
    });
  }
  async function idbGet(key){
    const db = await openDb();
    return new Promise((resolve,reject)=>{
      const tx = db.transaction('kv', 'readonly');
      const req = tx.objectStore('kv').get(key);
      req.onsuccess = ()=> resolve(req.result);
      req.onerror = ()=> reject(req.error || new Error('Gagal membaca IndexedDB.'));
    });
  }
  async function idbSet(key, value){
    const db = await openDb();
    return new Promise((resolve,reject)=>{
      const tx = db.transaction('kv', 'readwrite');
      tx.objectStore('kv').put(value, key);
      tx.oncomplete = ()=> resolve(true);
      tx.onerror = ()=> reject(tx.error || new Error('Gagal menyimpan IndexedDB.'));
    });
  }
  async function idbDelete(key){
    const db = await openDb();
    return new Promise((resolve,reject)=>{
      const tx = db.transaction('kv', 'readwrite');
      tx.objectStore('kv').delete(key);
      tx.oncomplete = ()=> resolve(true);
      tx.onerror = ()=> reject(tx.error || new Error('Gagal menghapus IndexedDB.'));
    });
  }
  async function hydrateState(){
    let parsed = null;
    try { parsed = await idbGet('state'); } catch {}
    if (!parsed) {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) parsed = JSON.parse(raw);
      } catch {}
    }
    State = normalizeState(parsed || clone(DEFAULT_STATE));
    State.session.deviceId ||= getOrCreateDeviceId();
    State.settings = { ...DEFAULT_REMOTE, ...(State.settings || {}) };
    dbReady = true;
    try { await idbSet('state', State); } catch {}
  }
  function saveState(silent=false){
    State = normalizeState(State);
    if(!silent) renderAll();
    if(dbReady){ idbSet('state', State).catch(()=>{}); }
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(State)); } catch {}
  }
  async function clearLocalAppData(){
    try { await idbDelete('state'); } catch {}
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  }
  function uid(prefix){ return `${prefix}-${Math.random().toString(36).slice(2,8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`; }
  function getOrCreateDeviceId(){ const k='sp_device_id_v5'; let v=localStorage.getItem(k); if(!v){ v=uid('DEV'); localStorage.setItem(k,v); } return v; }
  function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }
  function failedQueue(){ return Array.isArray(State.meta?.failedSyncQueue) ? State.meta.failedSyncQueue : (State.meta.failedSyncQueue = []); }
  function upsertFailedSync(item){
    const arr = failedQueue();
    const idx = arr.findIndex(x => x.key===item.key && x.id===item.id);
    const prev = idx >= 0 ? arr[idx] : {};
    const merged = { ...prev, ...item, attempts: Number(item.attempts ?? prev.attempts ?? 0), updatedAt: nowISO() };
    if(idx >= 0) arr[idx] = merged; else arr.push(merged);
  }
  function clearFailedSyncByRefs(refs){
    if(!refs?.length) return;
    const keys = new Set(refs.map(r => `${r.key}::${r.id}`));
    State.meta.failedSyncQueue = failedQueue().filter(x => !keys.has(`${x.key}::${x.id}`));
  }
  function clearFailedSyncByKeyId(key,id){ State.meta.failedSyncQueue = failedQueue().filter(x => !(x.key===key && x.id===id)); }
  function labelForKey(key){ return ({users:'User',estates:'Estate',peserta:'Peserta',mentors:'Mentor',reports:'Laporan'})[key] || key; }
  function fmtDateTime(iso){ if(!iso) return '-'; try { return new Intl.DateTimeFormat('id-ID',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(iso)); } catch { return iso; } }
  function getStateCollection(key){ return Array.isArray(State[key]) ? State[key] : []; }
  function nowISO(){ return new Date().toISOString(); }
  function todayISO(){ return new Date().toISOString().slice(0,10); }
  function esc(s){ return String(s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])); }
  function setStatus(text, kind='info'){ const el=$('#statusPill'); if(!el) return; el.textContent=text; el.style.background = kind==='ok' ? 'rgba(22,163,74,.18)' : kind==='no' ? 'rgba(220,38,38,.18)' : 'rgba(249,115,22,.18)'; }
  function setBusy(active, title='Sedang memproses...', sub='Mohon tunggu sebentar.', percent=15, step='Menyiapkan...'){
    const overlay = $('#loadingOverlay');
    const busyPill = $('#busyPill');
    if(!overlay || !busyPill) return;
    document.body.classList.toggle('is-busy', !!active);
    overlay.classList.toggle('hidden', !active);
    busyPill.classList.toggle('hidden', !active);
    busyPill.classList.toggle('busy', !!active);
    if(active){
      $('#loadingTitle').textContent = title;
      $('#loadingSub').textContent = sub;
      $('#loadingPercent').textContent = `${Math.max(0, Math.min(100, percent|0))}%`;
      $('#loadingBarFill').style.width = `${Math.max(0, Math.min(100, percent|0))}%`;
      $('#loadingStep').textContent = step;
      busyPill.textContent = step;
    }
  }
  function updateBusy(percent, step, sub){
    if($('#loadingOverlay')?.classList.contains('hidden')) return;
    if(typeof sub === 'string') $('#loadingSub').textContent = sub;
    $('#loadingPercent').textContent = `${Math.max(0, Math.min(100, percent|0))}%`;
    $('#loadingBarFill').style.width = `${Math.max(0, Math.min(100, percent|0))}%`;
    $('#loadingStep').textContent = step || 'Memproses...';
    $('#busyPill').textContent = step || 'Memproses...';
  }
  async function runBusy(task, cfg={}){
    const title = cfg.title || 'Sedang memproses...';
    const sub = cfg.sub || 'Mohon tunggu sebentar.';
    const startStep = cfg.step || 'Menyiapkan...';
    setBusy(true, title, sub, cfg.startPercent || 12, startStep);
    try {
      const result = await task((p,s,ss)=> updateBusy(p,s,ss));
      updateBusy(100, cfg.doneStep || 'Selesai', cfg.doneSub || sub);
      await new Promise(r=>setTimeout(r, 220));
      return result;
    } finally {
      setBusy(false);
    }
  }
  function applyTheme(theme){ const t=theme||'light'; document.body.classList.toggle('dark', t==='dark'); localStorage.setItem(THEME_KEY,t); $('#btnTheme').textContent = t==='dark' ? '☀️' : '🌙'; }
  function preferredTheme(){ return localStorage.getItem(THEME_KEY) || State.settings.defaultTheme || 'light'; }
  function openModal(id){ document.getElementById(id)?.classList.add('open'); }
  function closeModal(id){ document.getElementById(id)?.classList.remove('open'); }
  function copyText(text){ navigator.clipboard.writeText(text||'').then(()=>setStatus('Teks berhasil disalin','ok')).catch(()=>setStatus('Gagal menyalin teks','no')); }
  function sessionExpired(){
    const exp = State.session?.expiresAt ? new Date(State.session.expiresAt).getTime() : 0;
    return !!exp && Date.now() > exp;
  }
  function clearSession(preserveDevice=true){
    const deviceId = preserveDevice ? (State.session?.deviceId || getOrCreateDeviceId()) : '';
    State.session = { isLoggedIn:false, userId:'', deviceId, loginAt:'', expiresAt:'' };
  }
  function ensureSessionValid(silent=false){
    if(State.session?.isLoggedIn && sessionExpired()){
      clearSession(true);
      saveState(true);
      if(!silent) setStatus('Sesi login berakhir. Silakan login kembali.','info');
      return false;
    }
    return !!State.session?.isLoggedIn;
  }
  function currentUser(){
    ensureSessionValid(true);
    return State.users.find(u => u.id === State.session.userId) || null;
  }
  function isLoggedIn(){
    return ensureSessionValid(true) && !!currentUser();
  }
  function hasRole(...roles){ const role=(currentUser()?.role||'').toUpperCase(); return roles.includes(role); }
  function isAdmin(){ return hasRole('ADMIN'); }
  function canSeeAll(){ return hasRole('ADMIN','TC_HEAD'); }
  function normalizeCode(v){ return String(v||'').trim().toUpperCase().replace(/\s+/g,''); }
  function parseDivisiCode(code){ const m = normalizeCode(code).match(/^([A-Z]+)(\d+)$/); return m ? { estate:m[1], divisi:m[2] } : { estate:'', divisi:'' }; }
  function formatLongDate(iso){ if(!iso) return ''; return new Intl.DateTimeFormat('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date(`${iso}T00:00:00`)).replace(/^(.)/,m=>m.toUpperCase()); }
  function fmtShortDate(iso){ if(!iso) return ''; return new Intl.DateTimeFormat('id-ID',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(`${iso}T00:00:00`)); }
  function monthLabel(ym){ if(!ym) return ''; const [y,m]=String(ym).split('-'); return new Intl.DateTimeFormat('id-ID',{month:'long',year:'numeric'}).format(new Date(Number(y), Number(m||1)-1, 1)).replace(/^(.)/,m=>m.toUpperCase()); }
  function unique(arr){ return [...new Set(arr.filter(Boolean))]; }
  function normTextToken(v){
    return String(v||'')
      .toLowerCase()
      .normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
      .replace(/[“”"'`]+/g,'')
      .replace(/\bdan\b/g,' ')
      .replace(/[^a-z0-9\s-]/g,' ')
      .replace(/\s+/g,' ')
      .trim();
  }
  function titleCaseText(v){
    return String(v||'').toLowerCase().replace(/(^|\s)([a-zà-ÿ])/g, (_,a,b)=>`${a}${b.toUpperCase()}`);
  }
  function normalizeLocationToken(v){
    let s = String(v||'').trim().toUpperCase().replace(/\s+/g,'');
    if(!s) return '';
    const m = s.match(/^([A-Z]+)-?(\d+[A-Z]?)$/);
    if(m) return `${m[1]}-${m[2]}`;
    return String(v||'').trim().toUpperCase().replace(/\s+/g,' ');
  }
  function normalizeLocationList(v){
    return uniqueNormalized(String(v||'').split(/[;,\n]+/), 'location').join(', ');
  }
  function cleanupPhrase(v, mode='text'){
    let s = String(v||'').replace(/\s+/g,' ').trim();
    if(!s) return '';
    if(mode==='nameList') return s.split(',').map(x=>x.trim()).filter(Boolean).map(titleCaseText).join(', ');
    if(mode==='location') return normalizeLocationToken(s);
    if(mode==='topic') return s.toLowerCase();
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  function splitVals(v, mode='text'){
    const seen = new Set();
    const out = [];
    String(v||'').split(/[;,\n]+/).map(x=>cleanupPhrase(x, mode)).filter(Boolean).forEach(x=>{
      const key = normTextToken(x);
      if(!key || seen.has(key)) return;
      seen.add(key);
      out.push(x);
    });
    return out;
  }
  function uniqueNormalized(values, mode='text'){
    const seen = new Set();
    const out = [];
    values.forEach(v=>{
      const cleaned = cleanupPhrase(v, mode);
      const key = normTextToken(cleaned);
      if(!cleaned || !key || seen.has(key)) return;
      seen.add(key);
      out.push(cleaned);
    });
    return out;
  }
  function countNormalized(values, mode='text'){
    const map = new Map();
    values.forEach(v=>{
      const cleaned = cleanupPhrase(v, mode);
      const key = normTextToken(cleaned);
      if(!cleaned || !key) return;
      if(!map.has(key)) map.set(key, { label: cleaned, count: 0, firstIndex: map.size });
      map.get(key).count += 1;
    });
    return Array.from(map.values());
  }
  function topCountedLabels(values, mode='text', limit=5){
    return countNormalized(values, mode)
      .sort((a,b)=> (b.count-a.count) || a.firstIndex-b.firstIndex || String(a.label).localeCompare(String(b.label), 'id'))
      .slice(0, limit)
      .map(x=>x.label);
  }
  function countedNamesAlpha(values, limit=999){
    return countNormalized(values, 'nameList')
      .sort((a,b)=> String(a.label).localeCompare(String(b.label), 'id') || (b.count-a.count))
      .slice(0, limit)
      .map(x=> `${x.label} (${x.count})`);
  }
  function averageRounded(total, count){ return count ? Math.round((Number(total||0) / count) * 10) / 10 : 0; }
  function fmtAvg(v){ return Number.isInteger(v) ? String(v) : String(v.toFixed(1)).replace(/\.0$/,''); }

  function userScopeLabel(u=currentUser()){
    if(!u) return 'Belum login';
    if(['ADMIN','TC_HEAD'].includes(u.role)) return 'SEMUA ESTATE';
    if(u.role==='MANAGER') return u.estate || '-';
    return `${u.estate||''}${u.divisi||''}` || '-';
  }

  function canSeeReport(r, user=currentUser()){
    if(!user) return false;
    if(['ADMIN','TC_HEAD'].includes(user.role)) return true;
    if(user.role==='MANAGER') return r.estate===user.estate;
    if(user.role==='ASISTEN') return r.estate===user.estate && r.divisi===user.divisi;
    return String(r.createdBy?.userId||'') === String(user.id);
  }
  function scopedReports(user=currentUser()){ return State.reports.filter(r => canSeeReport(r,user)); }
  function scopedByMaster(items,user=currentUser()){
    if(!user) return [];
    if(['ADMIN','TC_HEAD'].includes(user.role)) return items;
    if(user.role==='MANAGER') return items.filter(x => x.estate===user.estate || x.code===user.estate);
    return items.filter(x => (x.estate===user.estate || x.code===user.estate) && String(x.divisi||'')===String(user.divisi||''));
  }

  const ReportPickerState = { pesertaBaik: [], pesertaBina: [] };
  function getMultiSelectValues(id){
    const vals = ReportPickerState[id];
    if(Array.isArray(vals)) return uniqueNormalized(vals, 'nameList');
    const el = $('#'+id);
    if(!el) return [];
    return Array.from(el.selectedOptions || []).map(opt => cleanupPhrase(opt.value || opt.textContent || '', 'nameList')).filter(Boolean);
  }
  function getReportParticipantValues(id){
    return uniqueNormalized(getMultiSelectValues(id), 'nameList');
  }
  function currentFormDivisiScope(){
    const user = currentUser() || {};
    const raw = normalizeCode($('#divisiCode')?.value || '');
    const parsed = parseDivisiCode(raw);
    if(parsed.estate && parsed.divisi) return parsed;
    if(user.estate && user.divisi && ['MANDOR','ASISTEN'].includes(user.role)) return { estate:user.estate, divisi:String(user.divisi) };
    return { estate:'', divisi:'' };
  }
  function scopedPesertaForReportForm(){
    const user = currentUser() || {};
    const scope = currentFormDivisiScope();
    let rows = State.peserta.filter(p => p.active !== false);
    if(!['ADMIN','TC_HEAD'].includes(user.role)) rows = scopedByMaster(rows, user);
    if(scope.estate && scope.divisi) rows = rows.filter(p => normalizeCode(p.estate)===normalizeCode(scope.estate) && String(p.divisi||'')===String(scope.divisi||''));
    else if(['ADMIN','TC_HEAD','MANAGER'].includes(user.role)) rows = [];
    return rows.slice().sort((a,b)=> String(a.name||'').localeCompare(String(b.name||''), 'id'));
  }
  function closeParticipantPanels(exceptId=''){
    ['pesertaBaik','pesertaBina'].forEach(id => {
      if(id!==exceptId) $('#'+id+'Panel')?.classList.add('hidden');
    });
  }
  function pruneParticipantSelectionsToScope(){
    const allowed = new Set(scopedPesertaForReportForm().map(r => normTextToken(cleanupPhrase(r.name||'', 'nameList'))));
    if(!allowed.size){
      ReportPickerState.pesertaBaik = [];
      ReportPickerState.pesertaBina = [];
      return;
    }
    ReportPickerState.pesertaBaik = getReportParticipantValues('pesertaBaik').filter(v => allowed.has(normTextToken(v)));
    ReportPickerState.pesertaBina = getReportParticipantValues('pesertaBina').filter(v => allowed.has(normTextToken(v)) && !ReportPickerState.pesertaBaik.some(x => normTextToken(x)===normTextToken(v)));
  }
  function removeParticipantFromField(fieldId, name){
    ReportPickerState[fieldId] = getReportParticipantValues(fieldId).filter(v => normTextToken(v)!==normTextToken(name));
    renderPesertaPickers();
  }
  function addParticipantToField(fieldId, name){
    const clean = cleanupPhrase(name || '', 'nameList');
    if(!clean) return;
    const otherId = fieldId === 'pesertaBaik' ? 'pesertaBina' : 'pesertaBaik';
    ReportPickerState[otherId] = getReportParticipantValues(otherId).filter(v => normTextToken(v)!==normTextToken(clean));
    const mine = getReportParticipantValues(fieldId);
    if(!mine.some(v => normTextToken(v)===normTextToken(clean))) mine.push(clean);
    ReportPickerState[fieldId] = uniqueNormalized(mine, 'nameList');
    renderPesertaPickers();
  }
  function renderParticipantPicker(fieldId){
    const selectedWrap = $('#'+fieldId+'Selected');
    const panel = $('#'+fieldId+'Panel');
    const list = $('#'+fieldId+'List');
    const searchEl = $('#'+fieldId+'Search');
    if(!selectedWrap || !panel || !list || !searchEl) return;
    const selected = getReportParticipantValues(fieldId);
    ReportPickerState[fieldId] = selected;
    const otherId = fieldId === 'pesertaBaik' ? 'pesertaBina' : 'pesertaBaik';
    const blocked = new Set(getReportParticipantValues(otherId).map(v => normTextToken(v)));
    selectedWrap.innerHTML = selected.length
      ? selected.map(name => `<span class="picker-chip">${esc(name)} <button type="button" data-remove-field="${fieldId}" data-name="${esc(name)}" aria-label="Hapus ${esc(name)}">×</button></span>`).join('')
      : `<div class="picker-empty">Belum ada peserta dipilih.</div>`;
    const kw = normTextToken(searchEl.value || '');
    const available = scopedPesertaForReportForm().map(row => cleanupPhrase(row.name || '', 'nameList')).filter(Boolean)
      .filter(name => !selected.some(v => normTextToken(v)===normTextToken(name)))
      .filter(name => !blocked.has(normTextToken(name)))
      .filter(name => !kw || normTextToken(name).includes(kw));
    list.innerHTML = available.length
      ? available.map(name => `<button type="button" class="picker-option" data-add-field="${fieldId}" data-name="${esc(name)}"><span>${esc(name)}</span><span class="meta">Tambah</span></button>`).join('')
      : `<div class="picker-muted">Tidak ada peserta yang bisa dipilih.</div>`;
  }
  function renderPesertaPickers(opts={}){
    if(opts.prune !== false) pruneParticipantSelectionsToScope();
    renderParticipantPicker('pesertaBaik');
    renderParticipantPicker('pesertaBina');
  }
  function setReportParticipantValues(baikVals, binaVals){
    ReportPickerState.pesertaBaik = uniqueNormalized(baikVals || [], 'nameList');
    ReportPickerState.pesertaBina = uniqueNormalized((binaVals || []).filter(v => !ReportPickerState.pesertaBaik.some(x => normTextToken(x)===normTextToken(v))), 'nameList');
    renderPesertaPickers({ prune:false });
  }
  function scopedUsers(user=currentUser()){

    if(!user) return [];
    if(user.role==='ADMIN') return State.users;
    if(user.role==='TC_HEAD') return State.users.filter(u => u.role!=='ADMIN');
    if(user.role==='MANAGER') return State.users.filter(u => u.estate===user.estate && u.role!=='ADMIN');
    return State.users.filter(u => u.id===user.id);
  }

  function mergeById(localArr, incoming){
    const map = new Map(localArr.map(x => [x.id, x]));
    (incoming||[]).forEach(item => map.set(item.id, { ...(map.get(item.id)||{}), ...item, synced:true }));
    return Array.from(map.values());
  }

  async function apiRequest(action, payload={}, preferGet=false){
    const gasUrl = (State.settings.gasUrl || DEFAULT_REMOTE.gasUrl || '').trim();
    if(!gasUrl) throw new Error('GAS URL belum tersedia.');
    const request = { action, sheetId: State.settings.sheetId || DEFAULT_REMOTE.sheetId, ...payload };
    const requestLen = JSON.stringify(request).length;
    const maxAttempts = action === 'pullAll' ? 2 : (action === 'syncBatch' ? 4 : 3);
    const timeoutMs = action === 'pullAll' ? 45000 : (action === 'syncBatch' ? 40000 : 30000);
    if (!preferGet || requestLen > 1400) {
      let lastErr = null;
      for(let attempt=1; attempt<=maxAttempts; attempt++){
        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timer = controller ? setTimeout(()=>controller.abort(), timeoutMs) : null;
        try {
          const res = await fetch(gasUrl, { method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'}, body: JSON.stringify(request), signal: controller?.signal });
          const raw = await res.text();
          let json = null;
          try { json = JSON.parse(raw); } catch { throw new Error(raw || 'Respons server tidak valid.'); }
          if(!json.success) throw new Error(json.message || 'Permintaan gagal.');
          if (timer) clearTimeout(timer);
          return json;
        } catch (err) {
          if (timer) clearTimeout(timer);
          lastErr = err?.name === 'AbortError' ? new Error('Koneksi timeout ke Apps Script.') : err;
          if (attempt < maxAttempts) await sleep(500 * attempt);
        }
      }
      if (requestLen > 8000) throw lastErr;
    }
    return await jsonpRequest(gasUrl, request);
  }
  function jsonpRequest(url, payload){
    return new Promise((resolve,reject)=>{
      const cb = `jsonp_cb_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
      const script = document.createElement('script');
      const timer = setTimeout(()=>{ cleanup(); reject(new Error('JSONP timeout.')); }, 25000);
      function cleanup(){ clearTimeout(timer); delete window[cb]; script.remove(); }
      window[cb] = (data)=>{ cleanup(); data && data.success ? resolve(data) : reject(new Error(data?.message || 'JSONP gagal.')); };
      script.onerror = ()=>{ cleanup(); reject(new Error('Gagal memanggil Apps Script via JSONP.')); };
      script.async = true;
      script.referrerPolicy = 'no-referrer';
      const params = new URLSearchParams();
      params.set('action', payload.action || '');
      params.set('sheetId', payload.sheetId || '');
      params.set('callback', cb);
      params.set('data', JSON.stringify(payload));
      params.set('_ts', String(Date.now()));
      script.src = `${url}?${params.toString()}`;
      document.body.appendChild(script);
    });
  }

  async function bootstrapOnline(){
    try {
      const data = await apiRequest('bootstrap', { profile: { id: currentUser()?.id || '', role: currentUser()?.role || '', estate: currentUser()?.estate || '', divisi: currentUser()?.divisi || '' } }, false);
      if (data.settings) State.settings = { ...State.settings, ...data.settings };
      if (Array.isArray(data.users) && data.users.length) State.users = mergeById(State.users, data.users);
      State.meta.lastBootstrapAt = nowISO();
      saveState(true);
      applyTheme(preferredTheme());
      setStatus('Konfigurasi online dimuat.','ok');
    } catch {
      // keep local defaults silently
    }
  }

  async function ensureRemoteUsers(progressCb){
    try {
      progressCb?.(28, 'Mengecek user di server...', 'Mengambil master user terbaru dari database online.');
      const data = await apiRequest('bootstrap', { profile: { id:'', role:'ADMIN', estate:'', divisi:'' } }, false);
      if (data.settings) State.settings = { ...State.settings, ...data.settings };
      if (Array.isArray(data.users) && data.users.length) {
        State.users = mergeById(State.users, data.users);
        saveState(true);
      }
    } catch {}
  }

  async function login(){
    const nip = normalizeCode($('#loginNip').value);
    const pin = String($('#loginPin').value || '').trim();
    if(!nip || !pin) return setStatus('NIP dan PIN wajib diisi.','no');
    const doLogin = async (progress)=>{
      progress(12, 'Memeriksa data login lokal...', 'Memastikan data user tersedia di perangkat ini.');
      let user = State.users.find(u => normalizeCode(u.nip)===nip && String(u.pin||'')===pin && u.active!==false);
      if(!user){
        await ensureRemoteUsers(progress);
        progress(55, 'Mencocokkan ulang NIP dan PIN...', 'Membandingkan data terbaru dari server.');
        user = State.users.find(u => normalizeCode(u.nip)===nip && String(u.pin||'')===pin && u.active!==false);
      }
      if(!user) throw new Error('NIP atau PIN tidak cocok. Pastikan data user sudah tersinkron dari server.');
      progress(72, 'Menyimpan sesi login...', 'Menyiapkan hak akses sesuai role user.');
      State.session.isLoggedIn = true;
      State.session.userId = user.id;
      State.session.loginAt = nowISO();
      State.session.expiresAt = new Date(Date.now() + LOGIN_TTL_MS).toISOString();
      saveState();
      closeModal('loginModal');
      fillFormDefaults();
      progress(86, 'Menarik data sesuai scope...', 'Mengambil data awal agar tampilan mobile sama dengan desktop.');
      try { await pullAll(true, progress); } catch {}
      return user;
    };
    try {
      const user = await runBusy(doLogin, { title:'Login ke aplikasi', sub:'Sedang menyiapkan akses user dan sinkronisasi awal.', step:'Memulai login...', doneStep:'Login selesai' });
      setStatus(`Login berhasil sebagai ${user.role}.`,'ok');
    } catch (err) {
      setStatus(err.message || 'Login gagal.','no');
    }
  }
  function logout(){ clearSession(true); saveState(); openModal('loginModal'); setStatus('Logout berhasil.','ok'); }

  function fillFormDefaults(){
    const u = currentUser() || {};
    $('#tanggal').value = $('#tanggal').value || todayISO();
    $('#hariTeks').value = formatLongDate($('#tanggal').value || todayISO());
    if (u.role === 'MANDOR') {
      $('#mandorName').value = u.name || '';
      if(u.estate && u.divisi) $('#divisiCode').value = `${u.estate}${u.divisi}`;
    }
    $('#rekapDate').value ||= todayISO();
    $('#rekapMonth').value ||= todayISO().slice(0,7);
    $('#rekapEstate').value = ['ADMIN','TC_HEAD'].includes(u.role) ? ($('#rekapEstate').value || '') : (u.estate || '');
    $('#rekapMonthlyEstate').value = ['ADMIN','TC_HEAD'].includes(u.role) ? ($('#rekapMonthlyEstate').value || '') : (u.estate || '');
    renderPesertaPickers();
  }
  function resetForm(){
    $('#editReportId').value = '';
    ['tanggal','hariTeks','divisiCode','mandorName','hadirCount','tidakHadirCount','ketidakhadiran','materi','mentorAktif','lokasi','catatanTeknis','kendala','tindakLanjut','waPreview'].forEach(id => { const el=$('#'+id); if(el) el.value=''; });
    ReportPickerState.pesertaBaik = []; ReportPickerState.pesertaBina = [];
    ['pesertaBaikSelected','pesertaBinaSelected','pesertaBaikList','pesertaBinaList'].forEach(id => { const el=$('#'+id); if(el) el.innerHTML=''; });
    ['pesertaBaikSearch','pesertaBinaSearch'].forEach(id => { const el=$('#'+id); if(el) el.value=''; });
    closeParticipantPanels();
    fillFormDefaults();
    setStatus('Form direset.');
  }
  function buildReportFromForm(){
    const divisiCode = normalizeCode($('#divisiCode').value);
    const parsed = parseDivisiCode(divisiCode);
    const user = currentUser() || {};
    const editId = $('#editReportId').value;
    const existing = editId ? State.reports.find(r => r.id===editId) : null;
    return {
      id: editId || uid('RPT'),
      createdAt: existing?.createdAt || nowISO(),
      updatedAt: nowISO(),
      tanggal: $('#tanggal').value,
      hariTeks: $('#hariTeks').value,
      divisiCode,
      estate: parsed.estate,
      divisi: parsed.divisi,
      mandorName: ($('#mandorName').value || '').trim().toUpperCase(),
      hadirCount: Number($('#hadirCount').value || 0),
      tidakHadirCount: Number($('#tidakHadirCount').value || 0),
      ketidakhadiran: ($('#ketidakhadiran').value || '').trim(),
      materi: ($('#materi').value || '').trim(),
      mentorAktif: Number($('#mentorAktif').value || 0),
      lokasi: normalizeLocationList($('#lokasi').value || ''),
      pesertaBaik: getReportParticipantValues('pesertaBaik').join(', '),
      pesertaBina: getReportParticipantValues('pesertaBina').join(', '),
      catatanTeknis: ($('#catatanTeknis').value || '').trim(),
      kendala: ($('#kendala').value || '').trim(),
      tindakLanjut: ($('#tindakLanjut').value || '').trim(),
      synced: false,
      syncedAt: '',
      deleted: false,
      createdBy: existing?.createdBy || { userId:user.id||'', name:user.name||'', role:user.role||'', estate:user.estate||'', divisi:user.divisi||'', nip:user.nip||'', deviceId:State.session.deviceId }
    };
  }
  function validateReport(r){
    if(!isLoggedIn()) return 'Silakan login dahulu.';
    if(!hasRole('MANDOR','ADMIN')) return 'Input laporan hanya untuk MANDOR atau ADMIN.';
    if(!r.tanggal) return 'Tanggal wajib diisi.';
    if(!r.divisiCode || !r.estate || !r.divisi) return 'Divisi wajib format seperti BTUE3.';
    if(!r.mandorName) return 'Nama mandor wajib diisi.';
    return '';
  }
  async function saveAndAutoSync(saveFn, options={}){
    const ok = await saveFn();
    if(!ok) return false;
    try {
      const keys = Array.isArray(options.keys) && options.keys.length ? options.keys : ['reports'];
      const label = options.label || 'Data';
      await runBusy((progress)=> syncOnlyKeys(keys, progress), {
        title: `${label} disimpan & sinkron`,
        sub: 'Data disimpan lokal lalu langsung dikirim ke database online.',
        step: 'Menyiapkan sinkron otomatis...',
        doneStep: 'Simpan & sinkron selesai'
      });
      setStatus(`${label} berhasil disimpan dan disinkronkan.`, 'ok');
      return true;
    } catch(err){
      setStatus(`${options.label || 'Data'} tersimpan lokal, tetapi sync otomatis gagal: ${err.message}`, 'info');
      return true;
    }
  }
  async function saveReport(){
    const report = buildReportFromForm();
    const err = validateReport(report);
    if(err){ setStatus(err,'no'); return false; }
    const idx = State.reports.findIndex(r => r.id===report.id);
    if(idx >= 0) State.reports[idx] = report; else State.reports.push(report);
    saveState();
    $('#waPreview').value = buildMandorWA(report);
    return true;
  }
  function editReport(id){
    const r = State.reports.find(x => x.id===id);
    if(!r || !canSeeReport(r)) return;
    $('#editReportId').value = r.id;
    ['tanggal','hariTeks','divisiCode','mandorName','hadirCount','tidakHadirCount','ketidakhadiran','materi','mentorAktif','catatanTeknis','kendala','tindakLanjut'].forEach(id => { if($('#'+id)) $('#'+id).value = r[id] ?? ''; });
    if($('#lokasi')) $('#lokasi').value = normalizeLocationList(r.lokasi || '');
    setReportParticipantValues(splitVals(r.pesertaBaik, 'nameList'), splitVals(r.pesertaBina, 'nameList'));
    $('#waPreview').value = buildMandorWA(r);
    activateTab('laporan');
    setStatus('Mode edit aktif.','ok');
  }
  async function deleteReport(id){
    const r = State.reports.find(x => x.id===id);
    if(!r || !canSeeReport(r)) return;
    if(!confirm('Hapus laporan ini?')) return;
    State.reports = State.reports.filter(x => x.id !== id);
    saveState();
    try { await apiRequest('deleteReport', { reportId: id }); setStatus('Laporan dihapus.','ok'); }
    catch { setStatus('Laporan dihapus lokal. Sinkronkan lagi bila perlu.'); }
  }

  async function saveUser(){
    if(!isAdmin()){ setStatus('Hanya ADMIN yang dapat mengubah user.','no'); return false; }
    const nip = normalizeCode($('#userNip').value); const name = ($('#userName').value||'').trim(); const role = $('#userRole').value;
    if(!nip || !name){ setStatus('NIP dan Nama user wajib diisi.','no'); return false; }
    const id = State.users.find(u => normalizeCode(u.nip)===nip)?.id || uid('USR');
    const user = {
      ...(State.users.find(u=>u.id===id)||{}), id, nip, name: name.toUpperCase(), role,
      estate: normalizeCode($('#userEstate').value), divisi: String($('#userDivisi').value||'').trim(), pin: String($('#userPin').value||'').trim() || (State.users.find(u=>u.id===id)?.pin || '1234'),
      active:true, createdAt: State.users.find(u=>u.id===id)?.createdAt || nowISO(), updatedAt: nowISO(), synced:false
    };
    if(nip==='TC001'){ user.role='ADMIN'; user.estate=''; user.divisi=''; }
    const idx = State.users.findIndex(u => u.id===id); if(idx>=0) State.users[idx]=user; else State.users.push(user);
    saveState(); return true;
  }
  async function saveEstate(){
    if(!isAdmin()){ setStatus('Hanya ADMIN yang dapat mengubah estate/divisi.','no'); return false; }
    const code = normalizeCode($('#estateCode').value); const divisi = String($('#estateDivisi').value||'').trim();
    if(!code || !divisi){ setStatus('Kode estate dan divisi wajib diisi.','no'); return false; }
    const divisiCode = `${code}${divisi}`; const id = State.estates.find(e => e.divisiCode===divisiCode)?.id || uid('EST');
    const item = { ...(State.estates.find(e=>e.id===id)||{}), id, code, estate: code, name: ($('#estateName').value||'').trim(), divisi, divisiCode, manager: ($('#estateManager').value||'').trim(), active:true, createdAt: State.estates.find(e=>e.id===id)?.createdAt||nowISO(), updatedAt:nowISO(), synced:false };
    const idx = State.estates.findIndex(e => e.id===id); if(idx>=0) State.estates[idx]=item; else State.estates.push(item);
    saveState(); return true;
  }
  async function savePeserta(){
    if(!isAdmin()){ setStatus('Hanya ADMIN yang dapat mengubah master peserta.','no'); return false; }
    const nip=normalizeCode($('#pesertaNip').value), name=($('#pesertaName').value||'').trim(); const divisiCode=normalizeCode($('#pesertaDivisiCode').value); const parsed=parseDivisiCode(divisiCode);
    if(!nip || !name || !divisiCode){ setStatus('NIP, nama, dan divisi peserta wajib diisi.','no'); return false; }
    const id = State.peserta.find(x=>normalizeCode(x.nip)===nip)?.id || uid('PST');
    const item = { ...(State.peserta.find(x=>x.id===id)||{}), id, nip, name: name.toUpperCase(), gender: $('#pesertaGender').value, divisiCode, estate: parsed.estate, divisi: parsed.divisi, mentorNip: normalizeCode($('#pesertaMentorNip').value), active:true, createdAt: State.peserta.find(x=>x.id===id)?.createdAt||nowISO(), updatedAt:nowISO(), synced:false };
    const idx=State.peserta.findIndex(x=>x.id===id); if(idx>=0) State.peserta[idx]=item; else State.peserta.push(item);
    saveState(); return true;
  }
  async function saveMentor(){
    if(!isAdmin()){ setStatus('Hanya ADMIN yang dapat mengubah master mentor.','no'); return false; }
    const nip=normalizeCode($('#mentorNip').value), name=($('#mentorName').value||'').trim(); const divisiCode=normalizeCode($('#mentorDivisiCode').value); const parsed=parseDivisiCode(divisiCode);
    if(!nip || !name || !divisiCode){ setStatus('NIP, nama, dan divisi mentor wajib diisi.','no'); return false; }
    const id=State.mentors.find(x=>normalizeCode(x.nip)===nip)?.id || uid('MTR');
    const item = { ...(State.mentors.find(x=>x.id===id)||{}), id, nip, name: name.toUpperCase(), divisiCode, estate: parsed.estate, divisi: parsed.divisi, active: $('#mentorActive').value==='TRUE', createdAt: State.mentors.find(x=>x.id===id)?.createdAt||nowISO(), updatedAt:nowISO(), synced:false };
    const idx=State.mentors.findIndex(x=>x.id===id); if(idx>=0) State.mentors[idx]=item; else State.mentors.push(item);
    saveState(); return true;
  }
  function resetUserForm(){ ['userNip','userName','userEstate','userDivisi','userPin'].forEach(id=>$('#'+id).value=''); $('#userRole').value='MANDOR'; }
  function resetEstateForm(){ ['estateCode','estateName','estateDivisi','estateManager'].forEach(id=>$('#'+id).value=''); }
  function resetPesertaForm(){ ['pesertaNip','pesertaName','pesertaDivisiCode','pesertaMentorNip'].forEach(id=>$('#'+id).value=''); $('#pesertaGender').value='L'; }
  function resetMentorForm(){ ['mentorNip','mentorName','mentorDivisiCode'].forEach(id=>$('#'+id).value=''); $('#mentorActive').value='TRUE'; }


  function findMandorReportBySelectedDate(){
    const date = $('#tanggal').value;
    if(!date) throw new Error('Pilih tanggal laporan terlebih dahulu.');
    const user = currentUser();
    let rows = scopedReports().filter(r => r.tanggal === date);
    if(user?.role === 'MANDOR') rows = rows.filter(r => String(r.createdBy?.userId||'') === String(user.id));
    const divisiCode = normalizeCode($('#divisiCode').value || (user?.estate && user?.divisi ? `${user.estate}${user.divisi}` : ''));
    if(divisiCode) rows = rows.filter(r => normalizeCode(r.divisiCode) === divisiCode);
    const mandor = normalizeCode($('#mandorName').value || user?.name || '');
    if(mandor) rows = rows.filter(r => normalizeCode(r.mandorName) === mandor || normalizeCode(r.createdBy?.name||'') === mandor);
    rows = rows.sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')));
    if(!rows.length) throw new Error('Belum ada laporan pada tanggal tersebut.');
    return rows[0];
  }
  function generateMandorWAByDate(){
    try {
      const r = findMandorReportBySelectedDate();
      $('#waPreview').value = buildMandorWA(r);
      setStatus('Preview WA dibuat dari laporan tanggal terpilih.','ok');
    } catch(err){
      $('#waPreview').value = '';
      setStatus(err.message,'no');
    }
  }
  async function resetApplication(){
    const unsynced = [State.users,State.estates,State.peserta,State.mentors,State.reports].flat().filter(x => !x.synced).length;
    const msg = unsynced
      ? `Masih ada ${unsynced} data lokal yang belum sync. Yakin ingin reset aplikasi ini? Data lokal akan dihapus.`
      : 'Pastikan data sudah di-sync. Yakin ingin reset aplikasi ini? Semua data lokal aplikasi ini akan dihapus.';
    if(!confirm(msg)) return;
    await clearLocalAppData();
    State = normalizeState(clone(DEFAULT_STATE));
    clearSession(true);
    dbReady = true;
    saveState(true);
    resetForm();
    renderAll();
    openModal('loginModal');
    setStatus('Data lokal aplikasi berhasil direset.','ok');
  }

  function buildMandorWA(r){
    return [
      '*Laporan Harian Sekolah Panen*',
      `Hari/Tanggal: ${formatLongDate(r.tanggal)}`,
      `Divisi: ${r.divisiCode}`,
      `Mandor: ${r.mandorName}`,'',
      '*Kehadiran:*', `Peserta hadir: ${r.hadirCount} orang`, `Peserta tidak hadir: ${r.tidakHadirCount} orang`, `Keterangan ketidakhadiran: ${r.ketidakhadiran || '-'}`,'',
      '*Kegiatan Hari Ini*:', `Materi: ${r.materi || '-'}`, `Mentor aktif: ${r.mentorAktif || 0} orang`, `Lokasi : ${r.lokasi || '-'}`,'',
      '*Hasil Pemantauan:*', `Peserta yang menunjukkan perkembangan baik: ${r.pesertaBaik || '-'}`, `Peserta yang masih perlu pembinaan: ${r.pesertaBina || '-'}`, `*Catatan teknis di lapangan:* ${r.catatanTeknis || '-'}`,'',
      '*Kendala Hari Ini:*', r.kendala || '-','', '*Rencana Tindak Lanjut Besok:*', r.tindakLanjut || '-', '', 'Demikian dan terima kasih.'
    ].join('\n');
  }
  function buildAggregate(date, role, estateFilter){
    const user = currentUser();
    let rows = scopedReports().filter(r => !date || r.tanggal===date);
    if (estateFilter) rows = rows.filter(r => r.estate===normalizeCode(estateFilter));
    if (role==='ASISTEN') {
      if(!hasRole('ADMIN','TC_HEAD','ASISTEN')) throw new Error('Role ini tidak dapat generate WA Asisten.');
      if(hasRole('ASISTEN')) rows = rows.filter(r => r.estate===user.estate && r.divisi===user.divisi);
      if(hasRole('ADMIN','TC_HEAD') && estateFilter) rows = rows.filter(r => r.estate===normalizeCode(estateFilter));
    }
    if (role==='MANAGER') {
      if(!hasRole('ADMIN','TC_HEAD','MANAGER')) throw new Error('Role ini tidak dapat generate WA Manager.');
      if(hasRole('MANAGER')) rows = rows.filter(r => r.estate===user.estate);
    }
    if (role==='TC_HEAD') {
      if(!hasRole('ADMIN','TC_HEAD')) throw new Error('Hanya TC Head/Admin yang dapat generate WA TC Head.');
    }
    return rows;
  }
  function buildRekapText(){
    const date = $('#rekapDate').value; const role = $('#rekapRole').value; const estateFilter = $('#rekapEstate').value;
    const rows = buildAggregate(date, role, estateFilter);
    if(!rows.length) throw new Error('Tidak ada data untuk filter ini.');
    const hadir = rows.reduce((s,r)=>s+Number(r.hadirCount||0),0);
    const tidak = rows.reduce((s,r)=>s+Number(r.tidakHadirCount||0),0);
    const mentor = rows.reduce((s,r)=>s+Number(r.mentorAktif||0),0);
    const estates = unique(rows.map(r=>r.estate)); const divisis = unique(rows.map(r=>r.divisiCode));
    const materi = unique(rows.flatMap(r=>splitVals(r.materi))).join(', ') || '-';
    const kendala = unique(rows.flatMap(r=>splitVals(r.kendala))).join('; ') || '-';
    const tindak = unique(rows.flatMap(r=>splitVals(r.tindakLanjut))).join('; ') || '-';
    if(role==='ASISTEN'){
      return [
        '*LAPORAN HARIAN SEKOLAH PANEN - ASISTEN*',
        `Hari/Tanggal : ${formatLongDate(date)}`,
        `Estate/Divisi : ${divisis.join(', ')}`,
        `Asisten : ${currentUser()?.name || '-'}`,'',
        '*Hadir*', `${hadir} orang`,'', '*Tidak Hadir*', `${tidak} orang`,'', '*Kegiatan*', materi,'', '*Temuan*', `Total laporan masuk ${rows.length} dari ${divisis.length} divisi.`, '', '*Kendala*', kendala,'', '*Tindak Lanjut*', tindak,'', 'Demikian izin melaporkan perkembangan kegiatan hari ini. Terima kasih.'
      ].join('\n');
    }
    if(role==='MANAGER'){
      return [
        '*LAPORAN HARIAN SEKOLAH PANEN - MANAGER UPDATE*',
        `Hari/Tanggal : ${formatLongDate(date)}`,
        `Estate : ${estates.join(', ')}`,'',
        '*Hadir*', `${hadir} orang`,'', '*Tidak Hadir*', `${tidak} orang`,'', '*Kegiatan*', materi,'', '*Temuan*', `Divisi terlapor: ${divisis.join(', ')}. Total mentor aktif: ${mentor} orang.`,'', '*Kendala*', kendala,'', '*Tindak Lanjut*', tindak,'', 'Demikian laporan harian kegiatan Sekolah Panen. Terima kasih.'
      ].join('\n');
    }
    return [
      '*LAPORAN HARIAN SEKOLAH PANEN - TC HEAD*',
      `Hari/Tanggal : ${formatLongDate(date)}`,'',
      '*Hadir*', `${hadir} orang`,'', '*Tidak Hadir*', `${tidak} orang`,'', '*Kegiatan*', materi,'', '*Temuan*', `Estate terlapor: ${estates.join(', ')}. Divisi terlapor: ${divisis.join(', ')}. Total mentor aktif: ${mentor} orang.`,'', '*Kendala*', kendala,'', '*Tindak Lanjut*', tindak,'', 'Demikian laporan harian kegiatan Sekolah Panen. Terima kasih.'
    ].join('\n');
  }


  function sanitizeForSyncRow(key, row){
    const base = clone(row || {});
    delete base.synced;
    delete base.deleted;
    if (base.createdBy && typeof base.createdBy === 'object') {
      base.createdBy = {
        userId: base.createdBy.userId || '',
        name: base.createdBy.name || '',
        role: base.createdBy.role || '',
        estate: base.createdBy.estate || '',
        divisi: base.createdBy.divisi || '',
        nip: base.createdBy.nip || '',
        deviceId: base.createdBy.deviceId || ''
      };
    }
    if (key === 'reports') {
      base.hadirCount = Number(base.hadirCount || 0);
      base.tidakHadirCount = Number(base.tidakHadirCount || 0);
      base.mentorAktif = Number(base.mentorAktif || 0);
    }
    return base;
  }
  function sanitizeRowsForSync(key, rows){ return (rows || []).map(row => sanitizeForSyncRow(key, row)); }
  function chunkArray(arr, size){ const out=[]; for(let i=0;i<arr.length;i+=size) out.push(arr.slice(i,i+size)); return out; }
  function collectPendingByKey(key, onlyFailed=false){
    const rows = getStateCollection(key);
    if(onlyFailed){
      const ids = new Set(failedQueue().filter(x => x.key===key).map(x => x.id));
      return rows.filter(x => ids.has(x.id));
    }
    return rows.filter(x => !x.synced);
  }
  function markRowsSynced(key, rows){
    const ids = new Set((rows||[]).map(x => x.id));
    getStateCollection(key).forEach(x => { if(ids.has(x.id)){ x.synced = true; x.syncedAt = nowISO(); } });
    clearFailedSyncByRefs((rows||[]).map(x => ({key, id:x.id})));
  }
  function markRowsFailed(key, rows, err){
    (rows||[]).forEach(row => {
      const current = failedQueue().find(x => x.key===key && x.id===row.id);
      upsertFailedSync({ key, id: row.id, name: row.name || row.mandorName || row.nip || row.divisiCode || row.code || row.id, error: String(err?.message || err || 'Sync gagal'), attempts: Number(current?.attempts || 0) + 1, lastAttemptAt: nowISO() });
    });
  }
  async function syncDatasetBatches(key, rows, progress, startPct, endPct){
    if(!rows.length) return { success:0, failed:0 };
    const prepared = sanitizeRowsForSync(key, rows);
    const chunkSize = key === 'reports' ? 8 : 15;
    const chunks = chunkArray(prepared, chunkSize);
    let success=0, failed=0;
    for(let i=0;i<chunks.length;i++){
      const part = chunks[i];
      const pct = startPct + Math.round(((i+1)/chunks.length) * Math.max(1, endPct - startPct));
      progress(pct, `Mengirim ${labelForKey(key)} batch ${i+1}/${chunks.length}...`, 'Koneksi lemah akan dicoba ulang otomatis. Bila satu batch gagal, sistem memecahnya per item.');
      try {
        await apiRequest('syncBatch', { entity: key, rows: part, timestamp: nowISO() }, false);
        markRowsSynced(key, part);
        success += part.length;
      } catch(err){
        for (let j=0;j<part.length;j++) {
          const single = part[j];
          try {
            progress(Math.min(endPct, pct), `Ulang per item ${j+1}/${part.length}...`, 'Batch gagal, sistem sedang memecah sinkronisasi menjadi item kecil.');
            await apiRequest('syncBatch', { entity: key, rows: [single], timestamp: nowISO() }, false);
            markRowsSynced(key, [single]);
            success += 1;
          } catch(singleErr) {
            markRowsFailed(key, [single], singleErr);
            failed += 1;
          }
          saveState(true);
          await sleep(120);
        }
      }
      saveState(true);
      await sleep(120);
    }
    return { success, failed };
  }
  async function retryFailedSyncAll(silent=false){
    if(!isLoggedIn()) return setStatus('Login dahulu.','no');
    const items = failedQueue();
    if(!items.length){ setStatus('Tidak ada data gagal sync.','ok'); return { success:true, retried:0 }; }
    const job = async (progress)=>{
      let totalSuccess=0, totalFailed=0;
      const keys = ['users','estates','peserta','mentors','reports'];
      for(let i=0;i<keys.length;i++){
        const key = keys[i];
        const rows = collectPendingByKey(key, true);
        const rangeStart = 10 + (i*16);
        const result = await syncDatasetBatches(key, rows, progress, rangeStart, rangeStart+12);
        totalSuccess += result.success; totalFailed += result.failed;
      }
      return { totalSuccess, totalFailed };
    };
    const res = silent ? await job(()=>{}) : await runBusy(job, { title:'Sync ulang data gagal', sub:'Hanya data yang sebelumnya gagal akan dikirim ulang.', step:'Menyiapkan daftar gagal...', doneStep:'Sync ulang selesai' });
    saveState();
    renderFailedSync();
    setStatus(res.totalFailed ? `Sebagian berhasil. ${res.totalFailed} item masih gagal.` : 'Semua data gagal berhasil di-sync ulang.', res.totalFailed ? 'info' : 'ok');
    return res;
  }
  function renderFailedSync(){
    const items = failedQueue().slice().sort((a,b)=> String(b.lastAttemptAt||'').localeCompare(String(a.lastAttemptAt||'')));
    $('#statFailedSync') && ($('#statFailedSync').textContent = items.length);
    $('#statFailedTypes') && ($('#statFailedTypes').textContent = new Set(items.map(x => x.key)).size || 0);
    $('#statFailedAttempts') && ($('#statFailedAttempts').textContent = items.reduce((s,x)=> s + Number(x.attempts||0), 0));
    $('#statFailedLast') && ($('#statFailedLast').textContent = items[0]?.lastAttemptAt ? fmtDateTime(items[0].lastAttemptAt) : '-');
    const wrap = $('#failedSyncList'); if(!wrap) return;
    wrap.innerHTML = items.length ? items.map(it => {
      const row = getStateCollection(it.key).find(x => x.id===it.id);
      const title = row?.name || row?.mandorName || row?.nip || row?.divisiCode || row?.code || it.name || it.id;
      const detail = row?.tanggal ? `${formatLongDate(row.tanggal)} • ${row.divisiCode || '-'}` : (row?.estate ? `${row.estate}${row.divisi ? ' • Divisi ' + row.divisi : ''}` : '-');
      return `
      <div class="list-item">
        <div class="list-title">${esc(labelForKey(it.key))} • ${esc(title)} <span class="chip no">Gagal</span></div>
        <div class="list-meta">ID: ${esc(it.id)} • ${esc(detail)} • Percobaan ${Number(it.attempts||0)} • ${esc(fmtDateTime(it.lastAttemptAt))}</div>
        <div class="list-body">${esc(it.error || '-')}</div>
        <div class="actions top-gap">
          <button class="btn secondary btn-sm" data-retry-failed="${esc(it.key)}::${esc(it.id)}" type="button">Sync Ulang Item Ini</button>
          <button class="btn secondary btn-sm" data-clear-failed="${esc(it.key)}::${esc(it.id)}" type="button">Hapus dari Daftar</button>
        </div>
      </div>`;
    }).join('') : '<div class="small muted">Belum ada data gagal sinkronisasi.</div>';
    $$('[data-retry-failed]').forEach(btn => btn.addEventListener('click', async ()=>{
      const [key,id] = btn.dataset.retryFailed.split('::');
      const row = getStateCollection(key).find(x => x.id===id);
      if(!row) return setStatus('Data lokal untuk item ini tidak ditemukan.','no');
      try {
        await runBusy((progress)=> syncDatasetBatches(key, [row], progress, 20, 85), { title:'Sync ulang item gagal', sub:'Item gagal sedang dikirim ulang ke server.', step:'Mengirim data...', doneStep:'Sync item selesai' });
        saveState(); renderAll(); renderFailedSync();
        setStatus('Item berhasil di-sync ulang.','ok');
      } catch(err){ setStatus(err.message,'no'); }
    }));
    $$('[data-clear-failed]').forEach(btn => btn.addEventListener('click', ()=>{
      const [key,id] = btn.dataset.clearFailed.split('::');
      clearFailedSyncByKeyId(key,id); saveState(); renderFailedSync(); setStatus('Log gagal dihapus dari daftar.','ok');
    }));
  }

  async function setupSheets(){ const res = await apiRequest('setupWorkbook', {}, false); $('#settingsResult').textContent = res.message; setStatus(res.message,'ok'); }
  async function testConnection(){ const res = await apiRequest('testConnection', {}, false); $('#settingsResult').textContent = `${res.message} ${res.time||''}`; setStatus('Koneksi berhasil.','ok'); }
  async function saveSettingsRemote(){
    if(!isAdmin()) return setStatus('Hanya ADMIN yang dapat mengubah pengaturan.','no');
    State.settings = { gasUrl: ($('#gasUrl').value||'').trim() || DEFAULT_REMOTE.gasUrl, sheetId: ($('#sheetId').value||'').trim() || DEFAULT_REMOTE.sheetId, defaultTheme: $('#defaultTheme').value || 'light' };
    State.meta.settingsDirty = true;
    saveState(true); applyTheme(State.settings.defaultTheme);
    try { const res = await apiRequest('saveConfig', { settings: State.settings }); State.meta.settingsDirty = false; saveState(true); $('#settingsResult').textContent = res.message; setStatus('Pengaturan disimpan ke database online.','ok'); }
    catch(err){ $('#settingsResult').textContent = err.message; setStatus(err.message,'no'); }
    renderAll();
  }
  async function syncOnlyKeys(keys, progressCb){
    if(!isLoggedIn()) throw new Error('Login dahulu.');
    const datasets = (Array.isArray(keys) ? keys : []).filter(Boolean);
    if(!datasets.length) return { success:true, totalSuccess:0, totalFailed:0, message:'Tidak ada dataset untuk sinkronisasi.' };
    let totalSuccess = 0;
    let totalFailed = 0;
    const unique = Array.from(new Set(datasets));
    for(let i=0;i<unique.length;i++){
      const key = unique[i];
      const rows = collectPendingByKey(key, false);
      const start = 18 + (i * Math.max(12, Math.floor(66 / Math.max(1, unique.length))));
      const end = Math.min(92, start + Math.max(8, Math.floor(58 / Math.max(1, unique.length))));
      const result = await syncDatasetBatches(key, rows, progressCb || (()=>{}), start, end);
      totalSuccess += result.success;
      totalFailed += result.failed;
    }
    saveState(true);
    renderFailedSync();
    return { success:true, totalSuccess, totalFailed, message: totalFailed ? `Sebagian data gagal sync (${totalFailed}).` : 'Data berhasil di-sync.' };
  }

  async function syncAll(silent=false, progressCb){
    if(!isLoggedIn()) return setStatus('Login dahulu.','no');
    const job = async (progress)=>{
      const datasets = ['users','estates','peserta','mentors','reports'];
      let totalSuccess = 0, totalFailed = 0;
      progress(8, 'Menyiapkan sinkronisasi...', 'Data akan dikirim bertahap per batch agar lebih aman di mobile.');
      if(State.meta.settingsDirty){
        try { await apiRequest('saveConfig', { settings: State.settings }, false); State.meta.settingsDirty = false; saveState(true); } catch {}
      }
      for(let i=0;i<datasets.length;i++){
        const key = datasets[i];
        const rows = collectPendingByKey(key, false);
        const start = 14 + (i * 16);
        const end = start + 13;
        const result = await syncDatasetBatches(key, rows, progress, start, end);
        totalSuccess += result.success;
        totalFailed += result.failed;
      }
      progress(94, 'Merapikan status lokal...', 'Memperbarui status sync dan daftar gagal.');
      saveState(true);
      return { success:true, totalSuccess, totalFailed, message: totalFailed ? `Sebagian data berhasil sync. ${totalFailed} item masih gagal.` : 'Semua data berhasil di-sync.' };
    };
    const res = silent ? await job(progressCb || (()=>{})) : await runBusy(job, { title:'Sinkronisasi data', sub:'Data lokal sedang dikirim ke database online per batch.', step:'Memulai sync...', doneStep:'Sync selesai' });
    saveState();
    renderAll();
    renderFailedSync();
    setStatus(res.message || 'Sync selesai.', res.totalFailed ? 'info' : 'ok');
    return res;
  }
  async function pullAll(silent=false, progressCb){
    if(!isLoggedIn()) return setStatus('Login dahulu.','no');
    const job = async (progress)=>{
      const user = currentUser();
      progress(12, 'Meminta data dari server...', 'Mengambil data sesuai role dan scope user.');
      const res = await apiRequest('pullAll', { profile: { id:user.id, role:user.role, estate:user.estate, divisi:user.divisi } }, false);
      progress(56, 'Menggabungkan data server ke lokal...', 'Mencegah duplikasi dan menjaga data yang sudah ada.');
      if(res.settings) State.settings = { ...State.settings, ...res.settings };
      if(Array.isArray(res.users)) State.users = mergeById(State.users, res.users);
      if(Array.isArray(res.estates)) State.estates = mergeById(State.estates, res.estates);
      if(Array.isArray(res.peserta)) State.peserta = mergeById(State.peserta, res.peserta);
      if(Array.isArray(res.mentors)) State.mentors = mergeById(State.mentors, res.mentors);
      if(Array.isArray(res.reports)) State.reports = mergeById(State.reports, res.reports);
      State.meta.lastPullAt = nowISO();
      saveState();
      return res;
    };
    const res = silent ? await job(progressCb || (()=>{})) : await runBusy(job, { title:'Menarik data terbaru', sub:'Data terbaru sedang ditarik dari database online.', step:'Memulai pull...', doneStep:'Pull selesai' });
    setStatus('Data terbaru berhasil ditarik.','ok');
    return res;
  }

  function filteredReports(){
    let rows = scopedReports();
    const estate = normalizeCode($('#filterEstate').value);
    const divisiRaw = normalizeCode($('#filterDivisi').value);
    const mandor = normalizeCode($('#filterMandor').value);
    const start = $('#filterStart').value; const end = $('#filterEnd').value;
    if(estate) rows = rows.filter(r => normalizeCode(r.estate)===estate);
    if(divisiRaw){
      const parsed = parseDivisiCode(divisiRaw);
      rows = rows.filter(r => normalizeCode(r.divisiCode)===divisiRaw || String(r.divisi)===divisiRaw || (parsed.estate && r.estate===parsed.estate && r.divisi===parsed.divisi));
    }
    if(mandor) rows = rows.filter(r => normalizeCode(r.mandorName).includes(mandor));
    if(start) rows = rows.filter(r => r.tanggal >= start);
    if(end) rows = rows.filter(r => r.tanggal <= end);
    return rows.sort((a,b)=>String(b.tanggal).localeCompare(String(a.tanggal)) || String(b.updatedAt).localeCompare(String(a.updatedAt)));
  }


  function buildMonthlyRecapRows(){
    const month = $('#rekapMonth').value || todayISO().slice(0,7);
    const user = currentUser();
    let rows = scopedReports().filter(r => String(r.tanggal || '').slice(0,7) === month);
    const estateFilter = normalizeCode($('#rekapMonthlyEstate').value || (!['ADMIN','TC_HEAD'].includes(user?.role) ? user?.estate : ''));
    const divisiRaw = normalizeCode($('#rekapMonthlyDivisi').value);
    if (estateFilter) rows = rows.filter(r => normalizeCode(r.estate) === estateFilter || normalizeCode(r.divisiCode).startsWith(estateFilter));
    if (divisiRaw) {
      const parsed = parseDivisiCode(divisiRaw);
      rows = rows.filter(r => normalizeCode(r.divisiCode) === divisiRaw || String(r.divisi) === divisiRaw || (parsed.estate && normalizeCode(r.estate)===parsed.estate && String(r.divisi)===parsed.divisi));
    }
    const map = new Map();
    rows.forEach(r => {
      const key = `${r.estate}|${r.divisi}|${r.divisiCode}`;
      if (!map.has(key)) {
        map.set(key, {
          month, estate:r.estate, divisi:r.divisi, divisiCode:r.divisiCode, jumlahLaporan:0,
          hadirTotal:0, tidakHadirTotal:0, mentorAktifTotal:0,
          materi:[], lokasi:[], mandor:[], kendala:[], tindakLanjut:[], pesertaBaik:[], pesertaBina:[], tanggal:[]
        });
      }
      const a = map.get(key);
      a.jumlahLaporan += 1;
      a.hadirTotal += Number(r.hadirCount || 0);
      a.tidakHadirTotal += Number(r.tidakHadirCount || 0);
      a.mentorAktifTotal += Number(r.mentorAktif || 0);
      a.materi.push(...splitVals(r.materi, 'topic'));
      a.lokasi.push(...splitVals(r.lokasi, 'location'));
      a.kendala.push(...splitVals(r.kendala, 'text'));
      a.tindakLanjut.push(...splitVals(r.tindakLanjut, 'text'));
      a.pesertaBaik.push(...splitVals(r.pesertaBaik, 'nameList'));
      a.pesertaBina.push(...splitVals(r.pesertaBina, 'nameList'));
      if (r.mandorName) a.mandor.push(cleanupPhrase(r.mandorName, 'nameList'));
      if (r.tanggal) a.tanggal.push(r.tanggal);
    });
    return Array.from(map.values()).map(a => ({
      month: a.month,
      estate: a.estate,
      divisi: a.divisi,
      divisiCode: a.divisiCode,
      jumlahLaporan: a.jumlahLaporan,
      hadir: averageRounded(a.hadirTotal, a.jumlahLaporan),
      tidakHadir: averageRounded(a.tidakHadirTotal, a.jumlahLaporan),
      mentorAktif: averageRounded(a.mentorAktifTotal, a.jumlahLaporan),
      materi: topCountedLabels(a.materi, 'topic', 5),
      lokasi: uniqueNormalized(a.lokasi, 'location'),
      mandor: uniqueNormalized(a.mandor, 'nameList'),
      kendala: topCountedLabels(a.kendala, 'text', 5),
      tindakLanjut: topCountedLabels(a.tindakLanjut, 'text', 5),
      pesertaBaik: countedNamesAlpha(a.pesertaBaik),
      pesertaBina: countedNamesAlpha(a.pesertaBina),
      hariLapor: uniqueNormalized(a.tanggal).sort()
    })).sort((x,y)=> normalizeCode(x.estate).localeCompare(normalizeCode(y.estate)) || Number(x.divisi||0)-Number(y.divisi||0));
  }
  function renderMonthlyRecap(){
    const wrap = $('#monthlyRecapCards');
    if (!wrap) return;
    const month = $('#rekapMonth').value || todayISO().slice(0,7);
    const rows = buildMonthlyRecapRows();
    wrap.innerHTML = rows.length ? rows.map(r => `
      <div class="report-card monthly-card">
        <div class="report-head">
          <div class="report-title">${esc(monthLabel(month))} • ${esc(r.divisiCode)} • ${esc(r.estate)}</div>
          <div class="chip ok">${esc(String(r.jumlahLaporan))} laporan</div>
        </div>
        <div class="report-meta">Hadir rata-rata ${fmtAvg(r.hadir)} | Tidak hadir rata-rata ${fmtAvg(r.tidakHadir)} | Mentor aktif rata-rata ${fmtAvg(r.mentorAktif)}</div>
        <div class="report-line"><strong>Mandor:</strong> ${esc(r.mandor.join(', ') || '-')}</div>
        <div class="report-line"><strong>Materi:</strong> ${esc(r.materi.join(', ') || '-')}</div>
        <div class="report-line"><strong>Lokasi:</strong> ${esc(r.lokasi.join(', ') || '-')}</div>
        <div class="report-line"><strong>Perkembangan baik:</strong> ${esc(r.pesertaBaik.join(', ') || '-')}</div>
        <div class="report-line"><strong>Perlu pembinaan:</strong> ${esc(r.pesertaBina.join(', ') || '-')}</div>
        <div class="report-line"><strong>Kendala utama:</strong> ${esc(r.kendala.join('; ') || '-')}</div>
        <div class="report-line"><strong>Tindak lanjut:</strong> ${esc(r.tindakLanjut.join('; ') || '-')}</div>
      </div>`).join('') : `<div class="small muted">Belum ada data rekap bulanan untuk ${esc(monthLabel(month))}.</div>`;
  }
  function exportMonthlyExcel(){
    const rows = buildMonthlyRecapRows();
    const month = $('#rekapMonth').value || todayISO().slice(0,7);
    if(!rows.length) return setStatus('Tidak ada data rekap bulanan untuk diexport.','no');
    const data = rows.map(r => ({
      Bulan: monthLabel(month), Estate: r.estate, Divisi: r.divisi, DivisiCode: r.divisiCode, JumlahLaporan: r.jumlahLaporan,
      HadirRataRata: fmtAvg(r.hadir), TidakHadirRataRata: fmtAvg(r.tidakHadir), MentorAktifRataRata: fmtAvg(r.mentorAktif), Mandor: r.mandor.join(', '),
      Materi: r.materi.join(', '), Lokasi: r.lokasi.join(', '), PesertaBaik: r.pesertaBaik.join(', '), PesertaBina: r.pesertaBina.join(', '),
      Kendala: r.kendala.join('; '), TindakLanjut: r.tindakLanjut.join('; '), HariLapor: r.hariLapor.map(fmtShortDate).join(', ')
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'RekapBulanan');
    XLSX.writeFile(wb, `rekap_bulanan_sekolah_pemanen_${month}.xlsx`);
    setStatus('Excel rekap bulanan berhasil dibuat.','ok');
  }
  function exportMonthlyPdf(){
    const rows = buildMonthlyRecapRows();
    const month = $('#rekapMonth').value || todayISO().slice(0,7);
    if(!rows.length) return setStatus('Tidak ada data rekap bulanan untuk PDF.','no');
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p','mm','a4');
    doc.setFontSize(16); doc.text('Rekap Bulanan Sekolah Pemanen', 14, 16);
    doc.setFontSize(10);
    doc.text(`Periode: ${monthLabel(month)}`, 14, 23);
    doc.text(`Dicetak oleh: ${currentUser()?.name || '-'} (${currentUser()?.role || '-'})`, 14, 29);
    doc.autoTable({
      startY: 35,
      head: [['Estate','Divisi','Jumlah Laporan','Hadir Rata-rata','Tidak Hadir Rata-rata','Mentor Aktif Rata-rata','Mandor','Materi','Kendala','Tindak Lanjut']],
      body: rows.map(r => [r.estate, r.divisiCode, r.jumlahLaporan, fmtAvg(r.hadir), fmtAvg(r.tidakHadir), fmtAvg(r.mentorAktif), r.mandor.join(', ') || '-', r.materi.join(', ') || '-', r.kendala.join('; ') || '-', r.tindakLanjut.join('; ') || '-']),
      styles: { fontSize: 8, cellPadding: 2, overflow:'linebreak' },
      headStyles: { fillColor: [249,115,22] },
      margin: { left: 10, right: 10 }
    });
    doc.save(`rekap_bulanan_sekolah_pemanen_${month}.pdf`);
    setStatus('PDF rekap bulanan berhasil dibuat.','ok');
  }

  function exportExcel(){
    const date = $('#rekapDate').value; const role = $('#rekapRole').value; const estate = $('#rekapEstate').value;
    let rows; try { rows = buildAggregate(date, role, estate); } catch(err){ return setStatus(err.message,'no'); }
    const data = rows.map(r => ({ Tanggal:r.tanggal, Hari:r.hariTeks, Estate:r.estate, Divisi:r.divisiCode, Mandor:r.mandorName, Hadir:r.hadirCount, TidakHadir:r.tidakHadirCount, Ketidakhadiran:r.ketidakhadiran, Materi:r.materi, MentorAktif:r.mentorAktif, Lokasi:r.lokasi, PesertaBaik:r.pesertaBaik, PesertaBina:r.pesertaBina, CatatanTeknis:r.catatanTeknis, Kendala:r.kendala, TindakLanjut:r.tindakLanjut }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Rekap');
    XLSX.writeFile(wb, `rekap_sekolah_pemanen_${role.toLowerCase()}_${date||todayISO()}.xlsx`);
    setStatus('Excel berhasil dibuat.','ok');
  }
  function exportPdf(){
    const date = $('#rekapDate').value; const role = $('#rekapRole').value; const estate = $('#rekapEstate').value;
    let rows; try { rows = buildAggregate(date, role, estate); } catch(err){ return setStatus(err.message,'no'); }
    if(!rows.length) return setStatus('Tidak ada data untuk PDF.','no');
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p','mm','a4');
    const title = `Laporan Manajemen Sekolah Pemanen - ${role}`;
    const hadir = rows.reduce((s,r)=>s+Number(r.hadirCount||0),0);
    const tidak = rows.reduce((s,r)=>s+Number(r.tidakHadirCount||0),0);
    doc.setFontSize(16); doc.text(title, 14, 16);
    doc.setFontSize(10);
    doc.text(`Tanggal laporan: ${formatLongDate(date || todayISO())}`, 14, 23);
    doc.text(`Dicetak oleh: ${currentUser()?.name || '-'} (${currentUser()?.role || '-'})`, 14, 29);
    doc.text(`Ringkasan: total laporan ${rows.length}, hadir ${hadir}, tidak hadir ${tidak}.`, 14, 35);
    doc.autoTable({
      startY: 40,
      head: [['Tanggal','Estate','Divisi','Mandor','Hadir','Tidak Hadir','Materi','Kendala','Tindak Lanjut']],
      body: rows.map(r => [fmtShortDate(r.tanggal), r.estate, r.divisiCode, r.mandorName, r.hadirCount, r.tidakHadirCount, r.materi || '-', r.kendala || '-', r.tindakLanjut || '-']),
      styles: { fontSize: 8, cellPadding: 2, overflow:'linebreak' },
      headStyles: { fillColor: [249,115,22] },
      margin: { left: 10, right: 10 }
    });
    doc.save(`laporan_manajemen_sekolah_pemanen_${role.toLowerCase()}_${date||todayISO()}.pdf`);
    setStatus('PDF formal berhasil dibuat.','ok');
  }

  function renderAuth(){
    const user = currentUser();
    $('#profileSummary').textContent = user ? `${user.role} • ${user.name} • Scope: ${userScopeLabel(user)}` : 'Belum login';
    $$('.auth-only').forEach(el => el.classList.toggle('hidden-tab', !isLoggedIn()));
    $$('.admin-only').forEach(el => el.classList.toggle('hidden-tab', !isAdmin()));
    $('#pengaturan').classList.toggle('hidden', !isAdmin());
    $('#master').classList.toggle('hidden', !isAdmin());
    $('#btnOpenLogin').classList.toggle('hidden', isLoggedIn());
    $('#btnLogout').classList.toggle('hidden', !isLoggedIn());
  }
  function renderPermissions(){
    const user = currentUser();
    $('#formCard').classList.toggle('hidden', !(user && hasRole('MANDOR','ADMIN')));
    const masterTab = document.querySelector('[data-tab="master"]'); if(masterTab) masterTab.classList.toggle('hidden-tab', !isAdmin());
    $('#scopeHint').textContent = `Scope aktif: ${userScopeLabel(user)}.`;
    const roleSel = $('#rekapRole');
    roleSel.innerHTML = '';
    const options = isAdmin() || hasRole('TC_HEAD') ? ['ASISTEN','MANAGER','TC_HEAD'] : hasRole('MANAGER') ? ['MANAGER'] : hasRole('ASISTEN') ? ['ASISTEN'] : ['ASISTEN'];
    options.forEach(v => roleSel.insertAdjacentHTML('beforeend', `<option value="${v}">${v}</option>`));
  }
  function renderDashboard(){
    const user = currentUser(); const reports = scopedReports(); const peserta = scopedByMaster(State.peserta); const mentors = scopedByMaster(State.mentors);
    $('#statTotalReports').textContent = reports.length; $('#statTodayReports').textContent = reports.filter(r => r.tanggal===todayISO()).length;
    $('#statHadir').textContent = reports.reduce((s,r)=>s+Number(r.hadirCount||0),0);
    $('#statTidakHadir').textContent = reports.reduce((s,r)=>s+Number(r.tidakHadirCount||0),0);
    $('#statPeserta').textContent = peserta.length; $('#statMentor').textContent = mentors.length;
    $('#statUsers').textContent = scopedUsers().length;
    $('#statUnsynced').textContent = [State.users,State.estates,State.peserta,State.mentors,State.reports].flat().filter(x => !x.synced).length;
    $('#scopeInfo').innerHTML = [
      ['Role aktif', user?.role || '-'], ['Nama user', user?.name || '-'], ['Scope', userScopeLabel(user)], ['Device ID', State.session.deviceId],
    ].map(([a,b]) => `<div class="info-row"><span>${esc(a)}</span><strong>${esc(b)}</strong></div>`).join('');
    $('#activityInfo').innerHTML = [
      ['Laporan tersimpan lokal', State.reports.length], ['Master peserta', State.peserta.length], ['Master mentor', State.mentors.length], ['Master estate/divisi', State.estates.length], ['Pull terakhir', State.meta.lastPullAt ? new Date(State.meta.lastPullAt).toLocaleString('id-ID') : '-']
    ].map(([a,b]) => `<div class="info-row"><span>${esc(a)}</span><strong>${esc(String(b))}</strong></div>`).join('');
    renderManagementKpi(reports, peserta, mentors);
    const latest = reports.slice().sort((a,b)=>String(b.tanggal).localeCompare(String(a.tanggal)) || String(b.updatedAt).localeCompare(String(a.updatedAt))).slice(0,8);
    $('#dashboardRecent').innerHTML = latest.length ? latest.map(r => `
      <div class="list-item">
        <div class="list-title">${esc(formatLongDate(r.tanggal))} • ${esc(r.divisiCode)} • ${esc(r.mandorName)} <span class="chip ${r.synced?'ok':'no'}">${r.synced?'Synced':'Local'}</span></div>
        <div class="list-meta">${esc(r.id)} • ${esc(r.createdBy?.name || '-')}</div>
        <div class="list-body">Hadir ${r.hadirCount} | Tidak hadir ${r.tidakHadirCount}
Materi: ${esc(r.materi)}
Lokasi: ${esc(r.lokasi)}</div>
      </div>`).join('') : '<div class="small muted">Belum ada laporan.</div>';
    renderCharts(reports);
  }

  function renderManagementKpi(reports, peserta, mentors){
    const wrap = $('#adminKpiSection');
    const allowed = hasRole('ADMIN','TC_HEAD');
    if(!wrap) return;
    wrap.classList.toggle('hidden', !allowed);
    if(!allowed) return;

    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    const monthReports = reports.filter(r => String(r.tanggal||'').slice(0,7)===ym);
    const estateSet = new Set(reports.map(r => normalizeCode(r.estate)).filter(Boolean));
    const divSet = new Set(reports.map(r => normalizeCode(r.divisiCode)).filter(Boolean));
    const totalHadir = reports.reduce((s,r)=>s+Number(r.hadirCount||0),0);
    const totalTidak = reports.reduce((s,r)=>s+Number(r.tidakHadirCount||0),0);
    const avgHadir = reports.length ? (totalHadir / reports.length) : 0;
    const ratioTidak = (totalHadir + totalTidak) ? ((totalTidak / (totalHadir + totalTidak)) * 100) : 0;
    const mappedCount = peserta.filter(p => String(p.mentorNip || '').trim()).length;
    const mappingPct = peserta.length ? Math.round((mappedCount / peserta.length) * 100) : 0;

    const estateCounts = {};
    const divAgg = {};
    reports.forEach(r => {
      const estate = normalizeCode(r.estate);
      const div = normalizeCode(r.divisiCode);
      if(estate) estateCounts[estate] = (estateCounts[estate] || 0) + 1;
      if(!div) return;
      if(!divAgg[div]) divAgg[div] = { divisiCode: div, reports: 0, hadir: 0, tidak: 0, estate };
      divAgg[div].reports += 1;
      divAgg[div].hadir += Number(r.hadirCount||0);
      divAgg[div].tidak += Number(r.tidakHadirCount||0);
    });
    const topEstate = Object.entries(estateCounts).sort((a,b)=>b[1]-a[1])[0]?.[0] || '-';
    const bestDiv = Object.values(divAgg).sort((a,b)=> (b.reports ? b.hadir/b.reports : 0) - (a.reports ? a.hadir/a.reports : 0))[0]?.divisiCode || '-';

    $('#kpiStats').innerHTML = [
      ['Estate Aktif', estateSet.size],
      ['Divisi Aktif', divSet.size],
      ['Rata-rata Hadir/Laporan', avgHadir.toFixed(1)],
      ['Rasio Tidak Hadir', `${ratioTidak.toFixed(1)}%`],
    ].map(([label, value]) => `<div class="stat-box"><span>${esc(label)}</span><strong>${esc(String(value))}</strong></div>`).join('');

    $('#kpiDetails').innerHTML = [
      ['Total peserta termapping mentor', `${mappingPct}%`],
      ['Total laporan bulan ini', monthReports.length],
      ['Estate dengan laporan terbanyak', topEstate],
      ['Divisi dengan rata-rata hadir tertinggi', bestDiv],
    ].map(([label, value]) => `<div class="info-row"><span>${esc(label)}</span><strong>${esc(String(value))}</strong></div>`).join('');

    const ranking = Object.values(divAgg).map(d => {
      const avg = d.reports ? d.hadir / d.reports : 0;
      const ratioNo = (d.hadir + d.tidak) ? (d.tidak / (d.hadir + d.tidak)) : 0;
      const base = avg >= 6 ? 5 : avg >= 5 ? 4 : avg >= 4 ? 3 : avg >= 2 ? 2 : avg > 0 ? 1 : 0;
      const score = Math.max(0, Math.min(5, base - (ratioNo >= 0.25 ? 1 : 0)));
      return { ...d, avg, score };
    }).sort((a,b)=> b.score-a.score || b.avg-a.avg || a.tidak-b.tidak);

    $('#kpiRanking').innerHTML = ranking.length ? ranking.slice(0,10).map((r, idx) => `
      <div class="list-item">
        <div class="list-title">#${idx+1} • ${esc(r.divisiCode || '-')}</div>
        <div class="list-meta">Laporan ${r.reports} • Hadir ${r.hadir} • Tidak hadir ${r.tidak}</div>
        <div class="list-body">Skor KPI: ${esc(r.score.toFixed(1))}</div>
      </div>`).join('') : '<div class="small muted">Belum ada data KPI.</div>';
  }

  function renderCharts(reports){
    const last7 = [...Array(7)].map((_,i)=>{ const d=new Date(); d.setDate(d.getDate()-(6-i)); return d.toISOString().slice(0,10); });
    const reportCounts = last7.map(dt => reports.filter(r => r.tanggal===dt).length);
    drawChart('chartReports', 'bar', { labels:last7.map(fmtShortDate), datasets:[{ label:'Laporan', data:reportCounts }] });

    const divMap = {};
    reports.forEach(r => { divMap[r.divisiCode] ||= { hadir:0, tidak:0 }; divMap[r.divisiCode].hadir += Number(r.hadirCount||0); divMap[r.divisiCode].tidak += Number(r.tidakHadirCount||0); });
    const divLabels = Object.keys(divMap).slice(0,10);
    drawChart('chartAttendance', 'bar', { labels:divLabels, datasets:[{ label:'Hadir', data:divLabels.map(k=>divMap[k].hadir) }, { label:'Tidak Hadir', data:divLabels.map(k=>divMap[k].tidak) }] });

    const estMap = {};
    reports.forEach(r => { estMap[r.estate] = (estMap[r.estate]||0)+1; });
    const estLabels = Object.keys(estMap);
    drawChart('chartEstate', 'pie', { labels:estLabels, datasets:[{ label:'Laporan', data:estLabels.map(k=>estMap[k]) }] });
  }
  function drawChart(id, type, data){
    const ctx = document.getElementById(id); if(!ctx || !window.Chart) return;
    charts[id]?.destroy();
    charts[id] = new Chart(ctx, { type, data, options:{ responsive:true, maintainAspectRatio:false, scales: type==='pie' ? {} : { y:{ beginAtZero:true } }, plugins:{ legend:{ position:'top' } } } });
  }
  function renderLists(){
    const user=currentUser();
    $('#userList').innerHTML = scopedUsers().map(u => `
      <div class="list-item"><div class="list-title">${esc(u.name)} • ${esc(u.role)}</div><div class="list-meta">${esc(u.nip)} • ${esc(userScopeLabel(u))}</div></div>`).join('') || '<div class="small muted">Belum ada data.</div>';
    $('#estateList').innerHTML = scopedByMaster(State.estates).map(e => `
      <div class="list-item"><div class="list-title">${esc(e.divisiCode)} • ${esc(e.name || e.code)}</div><div class="list-meta">PIC: ${esc(e.manager || '-')}</div></div>`).join('') || '<div class="small muted">Belum ada data.</div>';
    $('#pesertaList').innerHTML = scopedByMaster(State.peserta).map(p => `
      <div class="list-item"><div class="list-title">${esc(p.name)}</div><div class="list-meta">${esc(p.nip)} • ${esc(p.divisiCode)} • Mentor ${esc(p.mentorNip || '-')}</div></div>`).join('') || '<div class="small muted">Belum ada data.</div>';
    $('#mentorList').innerHTML = scopedByMaster(State.mentors).map(m => `
      <div class="list-item"><div class="list-title">${esc(m.name)}</div><div class="list-meta">${esc(m.nip)} • ${esc(m.divisiCode)} • ${m.active ? 'Aktif' : 'Nonaktif'}</div></div>`).join('') || '<div class="small muted">Belum ada data.</div>';
  }
  function renderDb(){
    const rows = filteredReports();
    $('#statTotal').textContent = rows.length; $('#statUnsyncedDb').textContent = rows.filter(r=>!r.synced).length; $('#statRole').textContent = currentUser()?.role || '-'; $('#statScope').textContent = userScopeLabel();
    $('#historyList').innerHTML = rows.length ? rows.map(r => `
      <div class="report-card">
        <div class="report-head">
          <div class="report-title">${esc(formatLongDate(r.tanggal))} • ${esc(r.divisiCode)} • ${esc(r.mandorName)} <span class="chip ${r.synced?'ok':'no'}">${r.synced?'Synced':'Local'}</span></div>
          <div class="inline-actions">
            <button class="btn secondary btn-sm" data-edit-report="${esc(r.id)}" type="button">Edit</button>
            <button class="btn secondary btn-sm" data-del-report="${esc(r.id)}" type="button">Hapus</button>
          </div>
        </div>
        <div class="report-meta">Hadir ${Number(r.hadirCount||0)} | Tidak hadir ${Number(r.tidakHadirCount||0)}</div>
        <div class="report-line"><strong>Materi:</strong> ${esc(r.materi || '-')}</div>
        <div class="report-line"><strong>Lokasi:</strong> ${esc(r.lokasi || '-')}</div>
      </div>`).join('') : '<div class="small muted">Belum ada data.</div>';
    $$('[data-edit-report]').forEach(btn => btn.addEventListener('click', ()=> editReport(btn.dataset.editReport)));
    $$('[data-del-report]').forEach(btn => btn.addEventListener('click', ()=> deleteReport(btn.dataset.delReport)));
  }
  function fillSettings(){ $('#gasUrl').value = State.settings.gasUrl || DEFAULT_REMOTE.gasUrl; $('#sheetId').value = State.settings.sheetId || DEFAULT_REMOTE.sheetId; $('#defaultTheme').value = State.settings.defaultTheme || 'light'; }
  function renderAll(){ renderAuth(); renderPermissions(); renderDashboard(); renderLists(); renderDb(); renderMonthlyRecap(); fillSettings(); renderFailedSync(); renderPesertaPickers(); }
  function activateTab(tabId){ $$('.tab').forEach(x=>x.classList.toggle('active', x.dataset.tab===tabId)); $$('.tab-panel').forEach(x=>x.classList.toggle('active', x.id===tabId)); }

  function initEvents(){
    $$('.tab').forEach(btn => btn.addEventListener('click', ()=> activateTab(btn.dataset.tab)));
    $('#tanggal').addEventListener('change', ()=> $('#hariTeks').value = formatLongDate($('#tanggal').value));
    $('#divisiCode').addEventListener('input', ()=> renderPesertaPickers({ prune:true }));
    $('#divisiCode').addEventListener('change', ()=> renderPesertaPickers({ prune:true }));
    $('#btnTogglePesertaBaik').addEventListener('click', ()=> { const p=$('#pesertaBaikPanel'); const open=p.classList.contains('hidden'); closeParticipantPanels(open ? 'pesertaBaik' : ''); p.classList.toggle('hidden', !open); if(open) { $('#pesertaBaikSearch').focus(); renderParticipantPicker('pesertaBaik'); } });
    $('#btnTogglePesertaBina').addEventListener('click', ()=> { const p=$('#pesertaBinaPanel'); const open=p.classList.contains('hidden'); closeParticipantPanels(open ? 'pesertaBina' : ''); p.classList.toggle('hidden', !open); if(open) { $('#pesertaBinaSearch').focus(); renderParticipantPicker('pesertaBina'); } });
    $('#pesertaBaikSearch').addEventListener('input', ()=> renderParticipantPicker('pesertaBaik'));
    $('#pesertaBinaSearch').addEventListener('input', ()=> renderParticipantPicker('pesertaBina'));
    document.addEventListener('click', (e)=> { const addBtn = e.target.closest('[data-add-field]'); const removeBtn = e.target.closest('[data-remove-field]'); if(addBtn){ addParticipantToField(addBtn.dataset.addField, addBtn.dataset.name || ''); return; } if(removeBtn){ removeParticipantFromField(removeBtn.dataset.removeField, removeBtn.dataset.name || ''); return; } if(!e.target.closest('#pickerPesertaBaikBox') && !e.target.closest('#pickerPesertaBinaBox')) closeParticipantPanels(); });
    $('#btnTheme').addEventListener('click', ()=> applyTheme(document.body.classList.contains('dark') ? 'light' : 'dark'));
    $('#btnOpenLogin').addEventListener('click', ()=> openModal('loginModal'));
    $('#btnLogout').addEventListener('click', logout);
    $('#btnDoLogin').addEventListener('click', login);
    $$('.close-btn,[data-close]').forEach(btn => btn.addEventListener('click', ()=> closeModal(btn.dataset.close || 'loginModal')));
    $('#btnSaveUser').addEventListener('click', ()=> saveAndAutoSync(saveUser, { keys:['users'], label:'User' })); $('#btnResetUser').addEventListener('click', resetUserForm);
    $('#btnSaveEstate').addEventListener('click', ()=> saveAndAutoSync(saveEstate, { keys:['estates'], label:'Estate/divisi' })); $('#btnResetEstate').addEventListener('click', resetEstateForm);
    $('#btnSavePeserta').addEventListener('click', ()=> saveAndAutoSync(savePeserta, { keys:['peserta'], label:'Peserta' })); $('#btnResetPeserta').addEventListener('click', resetPesertaForm);
    $('#btnSaveMentor').addEventListener('click', ()=> saveAndAutoSync(saveMentor, { keys:['mentors'], label:'Mentor' })); $('#btnResetMentor').addEventListener('click', resetMentorForm);
    $('#btnResetForm').addEventListener('click', resetForm); $('#btnSave').addEventListener('click', ()=> saveAndAutoSync(saveReport, { keys:['reports'], label:'Laporan' }));
    $('#btnGenerateMandor').addEventListener('click', generateMandorWAByDate);
    $('#btnCopyWA').addEventListener('click', ()=> copyText($('#waPreview').value));
    $('#btnOpenWA').addEventListener('click', ()=>{ const text=$('#waPreview').value; if(!text) return setStatus('Preview WA kosong.','no'); window.open(`https://wa.me/?text=${encodeURIComponent(text)}`,'_blank'); });
    $('#btnGenerateRekap').addEventListener('click', ()=>{ try { $('#rekapPreview').value = buildRekapText(); setStatus('Rekap WA dibuat.','ok'); } catch(err){ setStatus(err.message,'no'); } });
    $('#btnCopyRekap').addEventListener('click', ()=> copyText($('#rekapPreview').value));
    $('#btnExportExcel').addEventListener('click', exportExcel); $('#btnExportPdf').addEventListener('click', exportPdf);
    $('#btnGenerateMonthlyRecap').addEventListener('click', ()=>{ renderMonthlyRecap(); setStatus('Rekap bulanan ditampilkan.','ok'); });
    $('#btnExportMonthlyExcel').addEventListener('click', exportMonthlyExcel);
    $('#btnExportMonthlyPdf').addEventListener('click', exportMonthlyPdf);
    $('#btnSaveSettings').addEventListener('click', ()=> runBusy(()=>saveSettingsRemote(), { title:'Menyimpan pengaturan', sub:'Pengaturan koneksi sedang disimpan ke database online.', step:'Menyimpan pengaturan...', doneStep:'Pengaturan tersimpan' }).catch(err => { $('#settingsResult').textContent = err.message; setStatus(err.message,'no'); })); $('#btnSetupSheets').addEventListener('click', ()=> runBusy(()=>setupSheets(), { title:'Menyiapkan sheet online', sub:'Sheet dan header sedang dicek pada spreadsheet tujuan.', step:'Mengecek workbook...', doneStep:'Sheet siap' }).catch(err => { $('#settingsResult').textContent = err.message; setStatus(err.message,'no'); })); $('#btnTestConnection').addEventListener('click', ()=> runBusy(()=>testConnection(), { title:'Menguji koneksi', sub:'Sedang mencoba koneksi ke Apps Script.', step:'Menghubungi server...', doneStep:'Koneksi berhasil' }).catch(err => { $('#settingsResult').textContent = err.message; setStatus(err.message,'no'); }));
    $('#btnPull').addEventListener('click', ()=> pullAll().catch(err => setStatus(err.message,'no')));
    $('#btnRetryAllFailed')?.addEventListener('click', ()=> retryFailedSyncAll().catch(err => setStatus(err.message,'no')));
    $('#btnRefreshFailed')?.addEventListener('click', ()=> { renderFailedSync(); setStatus('Daftar gagal diperbarui.','ok'); });
    $('#btnClearFailedLog')?.addEventListener('click', ()=> { if(!failedQueue().length) return setStatus('Daftar gagal sudah kosong.','ok'); if(!confirm('Hapus semua log gagal sync?')) return; State.meta.failedSyncQueue = []; saveState(); renderFailedSync(); setStatus('Log gagal dibersihkan.','ok'); });
    $('#btnApplyFilter').addEventListener('click', renderDb); $('#btnClearFilter').addEventListener('click', ()=>{ ['filterEstate','filterDivisi','filterMandor','filterStart','filterEnd'].forEach(id=>$('#'+id).value=''); renderDb(); });
    $('#btnResetApp')?.addEventListener('click', resetApplication); ['rekapMonth','rekapMonthlyEstate','rekapMonthlyDivisi'].forEach(id=>$('#'+id)?.addEventListener('change', renderMonthlyRecap));
  }

  async function init(){
    await hydrateState();
    applyTheme(preferredTheme());
    fillFormDefaults();
    initEvents();
    await bootstrapOnline();
    ensureSessionValid(true);
    renderAll();
    if(!isLoggedIn()) openModal('loginModal');
  }
  document.addEventListener('DOMContentLoaded', init);
})();
