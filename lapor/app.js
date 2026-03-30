(() => {
  'use strict';

  const DEFAULT_REMOTE = {
    gasUrl: 'https://script.google.com/macros/s/AKfycbxy-ERQsMybRvnEtsUIk_oEqDBUwfswEp74cWsjVhNzAYeLb3vEo23nnhSUiScWagfH/exec',
    sheetId: '1B6KmlUCOKGozN6abEhp7nzpJMMm1BylBA-tKIrGZBSA',
    defaultTheme: 'light'
  };
  const STORAGE_KEY = 'sp_app_v3';
  const THEME_KEY = 'sp_theme_v3';
  const ADMIN_USER = {
    id: 'USR-TC001', nip: 'TC001', name: 'ADMIN', role: 'ADMIN', estate: '', divisi: '', pin: '1234',
    active: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), synced: false
  };
  const DEFAULT_STATE = {
    settings: { ...DEFAULT_REMOTE },
    session: { isLoggedIn: false, userId: '', deviceId: '' },
    users: [ADMIN_USER], estates: [], peserta: [], mentors: [], reports: [], meta: { lastBootstrapAt: '', lastPullAt: '' }
  };

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const charts = {};
  const State = loadState();
  State.session.deviceId ||= getOrCreateDeviceId();
  State.settings = { ...DEFAULT_REMOTE, ...(State.settings || {}) };

  function clone(v){ return JSON.parse(JSON.stringify(v)); }
  function loadState(){
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return clone(DEFAULT_STATE);
      const parsed = JSON.parse(raw);
      return {
        settings: { ...DEFAULT_REMOTE, ...(parsed.settings || {}) },
        session: { ...DEFAULT_STATE.session, ...(parsed.session || {}) },
        users: Array.isArray(parsed.users) && parsed.users.length ? parsed.users : [clone(ADMIN_USER)],
        estates: Array.isArray(parsed.estates) ? parsed.estates : [],
        peserta: Array.isArray(parsed.peserta) ? parsed.peserta : [],
        mentors: Array.isArray(parsed.mentors) ? parsed.mentors : [],
        reports: Array.isArray(parsed.reports) ? parsed.reports : [],
        meta: { ...(parsed.meta || {}) }
      };
    } catch {
      return clone(DEFAULT_STATE);
    }
  }
  function saveState(silent=false){ localStorage.setItem(STORAGE_KEY, JSON.stringify(State)); if(!silent) renderAll(); }
  function uid(prefix){ return `${prefix}-${Math.random().toString(36).slice(2,8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`; }
  function getOrCreateDeviceId(){ const k='sp_device_id_v3'; let v=localStorage.getItem(k); if(!v){ v=uid('DEV'); localStorage.setItem(k,v); } return v; }
  function nowISO(){ return new Date().toISOString(); }
  function todayISO(){ return new Date().toISOString().slice(0,10); }
  function esc(s){ return String(s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])); }
  function setStatus(text, kind='info'){ const el=$('#statusPill'); if(!el) return; el.textContent=text; el.style.background = kind==='ok' ? 'rgba(22,163,74,.18)' : kind==='no' ? 'rgba(220,38,38,.18)' : 'rgba(249,115,22,.18)'; }
  function applyTheme(theme){ const t=theme||'light'; document.body.classList.toggle('dark', t==='dark'); localStorage.setItem(THEME_KEY,t); $('#btnTheme').textContent = t==='dark' ? '☀️' : '🌙'; }
  function preferredTheme(){ return localStorage.getItem(THEME_KEY) || State.settings.defaultTheme || 'light'; }
  function openModal(id){ document.getElementById(id)?.classList.add('open'); }
  function closeModal(id){ document.getElementById(id)?.classList.remove('open'); }
  function copyText(text){ navigator.clipboard.writeText(text||'').then(()=>setStatus('Teks berhasil disalin','ok')).catch(()=>setStatus('Gagal menyalin teks','no')); }
  function currentUser(){ return State.users.find(u => u.id === State.session.userId) || null; }
  function isLoggedIn(){ return !!State.session.isLoggedIn && !!currentUser(); }
  function hasRole(...roles){ const role=(currentUser()?.role||'').toUpperCase(); return roles.includes(role); }
  function isAdmin(){ return hasRole('ADMIN'); }
  function canSeeAll(){ return hasRole('ADMIN','TC_HEAD'); }
  function normalizeCode(v){ return String(v||'').trim().toUpperCase().replace(/\s+/g,''); }
  function parseDivisiCode(code){ const m = normalizeCode(code).match(/^([A-Z]+)(\d+)$/); return m ? { estate:m[1], divisi:m[2] } : { estate:'', divisi:'' }; }
  function formatLongDate(iso){ if(!iso) return ''; return new Intl.DateTimeFormat('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date(`${iso}T00:00:00`)).replace(/^(.)/,m=>m.toUpperCase()); }
  function fmtShortDate(iso){ if(!iso) return ''; return new Intl.DateTimeFormat('id-ID',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(`${iso}T00:00:00`)); }
  function unique(arr){ return [...new Set(arr.filter(Boolean))]; }
  function splitVals(v){ return unique(String(v||'').split(/[;,\n]+/).map(x=>x.trim()).filter(Boolean)); }

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
    if (!preferGet) {
      try {
        const res = await fetch(gasUrl, { method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'}, body: JSON.stringify(request) });
        const json = await res.json();
        if(!json.success) throw new Error(json.message || 'Permintaan gagal.');
        return json;
      } catch (err) {
        if (JSON.stringify(request).length > 1500) throw err;
      }
    }
    return await jsonpRequest(gasUrl, request);
  }
  function jsonpRequest(url, payload){
    return new Promise((resolve,reject)=>{
      const cb = `jsonp_cb_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
      const script = document.createElement('script');
      const timer = setTimeout(()=>{ cleanup(); reject(new Error('JSONP timeout.')); }, 20000);
      function cleanup(){ clearTimeout(timer); delete window[cb]; script.remove(); }
      window[cb] = (data)=>{ cleanup(); data && data.success ? resolve(data) : reject(new Error(data?.message || 'JSONP gagal.')); };
      script.onerror = ()=>{ cleanup(); reject(new Error('Gagal memanggil Apps Script via JSONP.')); };
      script.src = `${url}?data=${encodeURIComponent(JSON.stringify({...payload, callback:cb}))}`;
      document.body.appendChild(script);
    });
  }

  async function bootstrapOnline(){
    try {
      const data = await apiRequest('bootstrap', { profile: { id: currentUser()?.id || '', role: currentUser()?.role || '', estate: currentUser()?.estate || '', divisi: currentUser()?.divisi || '' } }, true);
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

  function login(){
    const nip = normalizeCode($('#loginNip').value);
    const pin = String($('#loginPin').value || '').trim();
    const user = State.users.find(u => normalizeCode(u.nip)===nip && String(u.pin||'')===pin && u.active!==false);
    if(!user) return setStatus('NIP atau PIN tidak cocok.','no');
    State.session.isLoggedIn = true;
    State.session.userId = user.id;
    saveState();
    closeModal('loginModal');
    fillFormDefaults();
    pullAll().catch(()=>{});
    setStatus(`Login berhasil sebagai ${user.role}.`,'ok');
  }
  function logout(){ State.session = { isLoggedIn:false, userId:'', deviceId:State.session.deviceId }; saveState(); openModal('loginModal'); setStatus('Logout berhasil.','ok'); }

  function fillFormDefaults(){
    const u = currentUser() || {};
    $('#tanggal').value = $('#tanggal').value || todayISO();
    $('#hariTeks').value = formatLongDate($('#tanggal').value || todayISO());
    if (u.role === 'MANDOR') {
      $('#mandorName').value = u.name || '';
      if(u.estate && u.divisi) $('#divisiCode').value = `${u.estate}${u.divisi}`;
    }
    $('#rekapDate').value ||= todayISO();
    $('#rekapEstate').value = ['ADMIN','TC_HEAD'].includes(u.role) ? ($('#rekapEstate').value || '') : (u.estate || '');
  }
  function resetForm(){
    $('#editReportId').value = '';
    ['tanggal','hariTeks','divisiCode','mandorName','hadirCount','tidakHadirCount','ketidakhadiran','materi','mentorAktif','lokasi','pesertaBaik','pesertaBina','catatanTeknis','kendala','tindakLanjut','waPreview'].forEach(id => { const el=$('#'+id); if(el) el.value=''; });
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
      lokasi: ($('#lokasi').value || '').trim(),
      pesertaBaik: ($('#pesertaBaik').value || '').trim(),
      pesertaBina: ($('#pesertaBina').value || '').trim(),
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
  function saveReport(){
    const report = buildReportFromForm();
    const err = validateReport(report);
    if(err) return setStatus(err,'no');
    const idx = State.reports.findIndex(r => r.id===report.id);
    if(idx >= 0) State.reports[idx] = report; else State.reports.push(report);
    saveState();
    $('#waPreview').value = buildMandorWA(report);
    setStatus(idx >= 0 ? 'Laporan berhasil diperbarui.' : 'Laporan berhasil disimpan.','ok');
  }
  function editReport(id){
    const r = State.reports.find(x => x.id===id);
    if(!r || !canSeeReport(r)) return;
    $('#editReportId').value = r.id;
    ['tanggal','hariTeks','divisiCode','mandorName','hadirCount','tidakHadirCount','ketidakhadiran','materi','mentorAktif','lokasi','pesertaBaik','pesertaBina','catatanTeknis','kendala','tindakLanjut'].forEach(id => { if($('#'+id)) $('#'+id).value = r[id] ?? ''; });
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

  function saveUser(){
    if(!isAdmin()) return setStatus('Hanya ADMIN yang dapat mengubah user.','no');
    const nip = normalizeCode($('#userNip').value); const name = ($('#userName').value||'').trim(); const role = $('#userRole').value;
    if(!nip || !name) return setStatus('NIP dan Nama user wajib diisi.','no');
    const id = State.users.find(u => normalizeCode(u.nip)===nip)?.id || uid('USR');
    const user = {
      ...(State.users.find(u=>u.id===id)||{}), id, nip, name: name.toUpperCase(), role,
      estate: normalizeCode($('#userEstate').value), divisi: String($('#userDivisi').value||'').trim(), pin: String($('#userPin').value||'').trim() || (State.users.find(u=>u.id===id)?.pin || '1234'),
      active:true, createdAt: State.users.find(u=>u.id===id)?.createdAt || nowISO(), updatedAt: nowISO(), synced:false
    };
    if(nip==='TC001'){ user.role='ADMIN'; user.estate=''; user.divisi=''; }
    const idx = State.users.findIndex(u => u.id===id); if(idx>=0) State.users[idx]=user; else State.users.push(user);
    saveState(); setStatus('User disimpan.','ok');
  }
  function saveEstate(){
    if(!isAdmin()) return setStatus('Hanya ADMIN yang dapat mengubah estate/divisi.','no');
    const code = normalizeCode($('#estateCode').value); const divisi = String($('#estateDivisi').value||'').trim();
    if(!code || !divisi) return setStatus('Kode estate dan divisi wajib diisi.','no');
    const divisiCode = `${code}${divisi}`; const id = State.estates.find(e => e.divisiCode===divisiCode)?.id || uid('EST');
    const item = { ...(State.estates.find(e=>e.id===id)||{}), id, code, estate: code, name: ($('#estateName').value||'').trim(), divisi, divisiCode, manager: ($('#estateManager').value||'').trim(), active:true, createdAt: State.estates.find(e=>e.id===id)?.createdAt||nowISO(), updatedAt:nowISO(), synced:false };
    const idx = State.estates.findIndex(e => e.id===id); if(idx>=0) State.estates[idx]=item; else State.estates.push(item);
    saveState(); setStatus('Estate/divisi disimpan.','ok');
  }
  function savePeserta(){
    if(!hasRole('ADMIN','TC_HEAD','MANAGER','ASISTEN')) return setStatus('Tidak berwenang mengubah master peserta.','no');
    const nip=normalizeCode($('#pesertaNip').value), name=($('#pesertaName').value||'').trim(); const divisiCode=normalizeCode($('#pesertaDivisiCode').value); const parsed=parseDivisiCode(divisiCode);
    if(!nip || !name || !divisiCode) return setStatus('NIP, nama, dan divisi peserta wajib diisi.','no');
    const id = State.peserta.find(x=>normalizeCode(x.nip)===nip)?.id || uid('PST');
    const item = { ...(State.peserta.find(x=>x.id===id)||{}), id, nip, name: name.toUpperCase(), gender: $('#pesertaGender').value, divisiCode, estate: parsed.estate, divisi: parsed.divisi, mentorNip: normalizeCode($('#pesertaMentorNip').value), active:true, createdAt: State.peserta.find(x=>x.id===id)?.createdAt||nowISO(), updatedAt:nowISO(), synced:false };
    const idx=State.peserta.findIndex(x=>x.id===id); if(idx>=0) State.peserta[idx]=item; else State.peserta.push(item);
    saveState(); setStatus('Peserta disimpan.','ok');
  }
  function saveMentor(){
    if(!hasRole('ADMIN','TC_HEAD','MANAGER','ASISTEN')) return setStatus('Tidak berwenang mengubah master mentor.','no');
    const nip=normalizeCode($('#mentorNip').value), name=($('#mentorName').value||'').trim(); const divisiCode=normalizeCode($('#mentorDivisiCode').value); const parsed=parseDivisiCode(divisiCode);
    if(!nip || !name || !divisiCode) return setStatus('NIP, nama, dan divisi mentor wajib diisi.','no');
    const id=State.mentors.find(x=>normalizeCode(x.nip)===nip)?.id || uid('MTR');
    const item = { ...(State.mentors.find(x=>x.id===id)||{}), id, nip, name: name.toUpperCase(), divisiCode, estate: parsed.estate, divisi: parsed.divisi, active: $('#mentorActive').value==='TRUE', createdAt: State.mentors.find(x=>x.id===id)?.createdAt||nowISO(), updatedAt:nowISO(), synced:false };
    const idx=State.mentors.findIndex(x=>x.id===id); if(idx>=0) State.mentors[idx]=item; else State.mentors.push(item);
    saveState(); setStatus('Mentor disimpan.','ok');
  }
  function resetUserForm(){ ['userNip','userName','userEstate','userDivisi','userPin'].forEach(id=>$('#'+id).value=''); $('#userRole').value='MANDOR'; }
  function resetEstateForm(){ ['estateCode','estateName','estateDivisi','estateManager'].forEach(id=>$('#'+id).value=''); }
  function resetPesertaForm(){ ['pesertaNip','pesertaName','pesertaDivisiCode','pesertaMentorNip'].forEach(id=>$('#'+id).value=''); $('#pesertaGender').value='L'; }
  function resetMentorForm(){ ['mentorNip','mentorName','mentorDivisiCode'].forEach(id=>$('#'+id).value=''); $('#mentorActive').value='TRUE'; }

  function buildMandorWA(r){
    return [
      '*Laporan Harian Sekolah Panen*',
      `Hari/Tanggal: ${formatLongDate(r.tanggal)}`,
      `Divisi: ${r.divisiCode}`,
      `Mandor: ${r.mandorName}`,'',
      '*Kehadiran:*', `Peserta hadir: ${r.hadirCount} orang`, `Peserta tidak hadir: ${r.tidakHadirCount} orang`, `Keterangan ketidakhadiran: ${r.ketidakhadiran || '-'}`,'',
      '*Kegiatan Hari Ini*:', `Materi: ${r.materi || '-'}`, `Mentor aktif: ${r.mentorAktif || 0} orang`, `Lokasi : ${r.lokasi || '-'}`,'',
      '*Hasil Pemantauan:*', `Peserta yang menunjukkan perkembangan baik: ${r.pesertaBaik || '-'}`, `Peserta yang masih perlu pembinaan: ${r.pesertaBina || '-'}`, `Catatan teknis di lapangan: ${r.catatanTeknis || '-'}`,'',
      '*Kendala Hari Ini:*', r.kendala || '-','', 'Rencana Tindak Lanjut Besok:', r.tindakLanjut || '-', '', 'Demikian dan terima kasih.'
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

  async function setupSheets(){ const res = await apiRequest('setupWorkbook', {}, true); $('#settingsResult').textContent = res.message; setStatus(res.message,'ok'); }
  async function testConnection(){ const res = await apiRequest('testConnection', {}, true); $('#settingsResult').textContent = `${res.message} ${res.time||''}`; setStatus('Koneksi berhasil.','ok'); }
  async function saveSettingsRemote(){
    if(!isAdmin()) return setStatus('Hanya ADMIN yang dapat mengubah pengaturan.','no');
    State.settings = { gasUrl: ($('#gasUrl').value||'').trim() || DEFAULT_REMOTE.gasUrl, sheetId: ($('#sheetId').value||'').trim() || DEFAULT_REMOTE.sheetId, defaultTheme: $('#defaultTheme').value || 'light' };
    saveState(true); applyTheme(State.settings.defaultTheme);
    try { const res = await apiRequest('saveConfig', { settings: State.settings }); $('#settingsResult').textContent = res.message; setStatus('Pengaturan disimpan ke database online.','ok'); }
    catch(err){ $('#settingsResult').textContent = err.message; setStatus(err.message,'no'); }
    renderAll();
  }
  async function syncAll(){
    if(!isLoggedIn()) return setStatus('Login dahulu.','no');
    const payload = { users: State.users, estates: State.estates, peserta: State.peserta, mentors: State.mentors, reports: State.reports, settings: State.settings, timestamp: nowISO() };
    const res = await apiRequest('syncAll', payload);
    ['users','estates','peserta','mentors','reports'].forEach(key => State[key].forEach(x => { x.synced = true; x.syncedAt = nowISO(); }));
    saveState(); setStatus(res.message || 'Sync berhasil.','ok');
  }
  async function pullAll(){
    if(!isLoggedIn()) return setStatus('Login dahulu.','no');
    const user = currentUser();
    const res = await apiRequest('pullAll', { profile: { id:user.id, role:user.role, estate:user.estate, divisi:user.divisi } }, true);
    if(res.settings) State.settings = { ...State.settings, ...res.settings };
    if(Array.isArray(res.users)) State.users = mergeById(State.users, res.users);
    if(Array.isArray(res.estates)) State.estates = mergeById(State.estates, res.estates);
    if(Array.isArray(res.peserta)) State.peserta = mergeById(State.peserta, res.peserta);
    if(Array.isArray(res.mentors)) State.mentors = mergeById(State.mentors, res.mentors);
    if(Array.isArray(res.reports)) State.reports = mergeById(State.reports, res.reports);
    State.meta.lastPullAt = nowISO();
    saveState(); setStatus('Data terbaru berhasil ditarik.','ok');
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
    $('#btnOpenLogin').classList.toggle('hidden', isLoggedIn());
    $('#btnLogout').classList.toggle('hidden', !isLoggedIn());
  }
  function renderPermissions(){
    const user = currentUser();
    $('#formCard').classList.toggle('hidden', !(user && hasRole('MANDOR','ADMIN')));
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
    const latest = reports.slice().sort((a,b)=>String(b.tanggal).localeCompare(String(a.tanggal)) || String(b.updatedAt).localeCompare(String(a.updatedAt))).slice(0,8);
    $('#dashboardRecent').innerHTML = latest.length ? latest.map(r => `
      <div class="list-item">
        <div class="list-title">${esc(formatLongDate(r.tanggal))} • ${esc(r.divisiCode)} • ${esc(r.mandorName)} <span class="chip ${r.synced?'ok':'no'}">${r.synced?'Synced':'Local'}</span></div>
        <div class="list-meta">${esc(r.id)} • ${esc(r.createdBy?.name || '-')}</div>
        <div class="list-body">Hadir ${r.hadirCount} | Tidak hadir ${r.tidakHadirCount}\nMateri: ${esc(r.materi)}\nLokasi: ${esc(r.lokasi)}</div>
      </div>`).join('') : '<div class="small muted">Belum ada laporan.</div>';
    renderCharts(reports);
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
      <div class="list-item">
        <div class="list-title">${esc(formatLongDate(r.tanggal))} • ${esc(r.divisiCode)} • ${esc(r.mandorName)}<span class="chip ${r.synced?'ok':'no'}">${r.synced?'Synced':'Local'}</span></div>
        <div class="list-meta">${esc(r.id)} • ${esc(r.createdBy?.name || '-')}</div>
        <div class="list-body">${esc(buildMandorWA(r))}</div>
        <div class="actions top-gap">
          <button class="btn secondary btn-sm" data-edit-report="${esc(r.id)}" type="button">Edit</button>
          <button class="btn secondary btn-sm" data-del-report="${esc(r.id)}" type="button">Hapus</button>
        </div>
      </div>`).join('') : '<div class="small muted">Belum ada data.</div>';
    $$('[data-edit-report]').forEach(btn => btn.addEventListener('click', ()=> editReport(btn.dataset.editReport)));
    $$('[data-del-report]').forEach(btn => btn.addEventListener('click', ()=> deleteReport(btn.dataset.delReport)));
  }
  function fillSettings(){ $('#gasUrl').value = State.settings.gasUrl || DEFAULT_REMOTE.gasUrl; $('#sheetId').value = State.settings.sheetId || DEFAULT_REMOTE.sheetId; $('#defaultTheme').value = State.settings.defaultTheme || 'light'; }
  function renderAll(){ renderAuth(); renderPermissions(); renderDashboard(); renderLists(); renderDb(); fillSettings(); }
  function activateTab(tabId){ $$('.tab').forEach(x=>x.classList.toggle('active', x.dataset.tab===tabId)); $$('.tab-panel').forEach(x=>x.classList.toggle('active', x.id===tabId)); }

  function initEvents(){
    $$('.tab').forEach(btn => btn.addEventListener('click', ()=> activateTab(btn.dataset.tab)));
    $('#tanggal').addEventListener('change', ()=> $('#hariTeks').value = formatLongDate($('#tanggal').value));
    $('#btnTheme').addEventListener('click', ()=> applyTheme(document.body.classList.contains('dark') ? 'light' : 'dark'));
    $('#btnOpenLogin').addEventListener('click', ()=> openModal('loginModal'));
    $('#btnLogout').addEventListener('click', logout);
    $('#btnDoLogin').addEventListener('click', login);
    $$('.close-btn,[data-close]').forEach(btn => btn.addEventListener('click', ()=> closeModal(btn.dataset.close || 'loginModal')));
    $('#btnSaveUser').addEventListener('click', saveUser); $('#btnResetUser').addEventListener('click', resetUserForm);
    $('#btnSaveEstate').addEventListener('click', saveEstate); $('#btnResetEstate').addEventListener('click', resetEstateForm);
    $('#btnSavePeserta').addEventListener('click', savePeserta); $('#btnResetPeserta').addEventListener('click', resetPesertaForm);
    $('#btnSaveMentor').addEventListener('click', saveMentor); $('#btnResetMentor').addEventListener('click', resetMentorForm);
    $('#btnResetForm').addEventListener('click', resetForm); $('#btnSave').addEventListener('click', saveReport);
    $('#btnGenerateMandor').addEventListener('click', ()=>{ const r=buildReportFromForm(); const err=validateReport(r); if(err) return setStatus(err,'no'); $('#waPreview').value=buildMandorWA(r); setStatus('Preview WA dibuat.','ok'); });
    $('#btnCopyWA').addEventListener('click', ()=> copyText($('#waPreview').value));
    $('#btnOpenWA').addEventListener('click', ()=>{ const text=$('#waPreview').value; if(!text) return setStatus('Preview WA kosong.','no'); window.open(`https://wa.me/?text=${encodeURIComponent(text)}`,'_blank'); });
    $('#btnGenerateRekap').addEventListener('click', ()=>{ try { $('#rekapPreview').value = buildRekapText(); setStatus('Rekap WA dibuat.','ok'); } catch(err){ setStatus(err.message,'no'); } });
    $('#btnCopyRekap').addEventListener('click', ()=> copyText($('#rekapPreview').value));
    $('#btnExportExcel').addEventListener('click', exportExcel); $('#btnExportPdf').addEventListener('click', exportPdf);
    $('#btnSaveSettings').addEventListener('click', saveSettingsRemote); $('#btnSetupSheets').addEventListener('click', ()=> setupSheets().catch(err => $('#settingsResult').textContent = err.message)); $('#btnTestConnection').addEventListener('click', ()=> testConnection().catch(err => $('#settingsResult').textContent = err.message));
    $('#btnSync').addEventListener('click', ()=> syncAll().catch(err => setStatus(err.message,'no'))); $('#btnPull').addEventListener('click', ()=> pullAll().catch(err => setStatus(err.message,'no')));
    $('#btnApplyFilter').addEventListener('click', renderDb); $('#btnClearFilter').addEventListener('click', ()=>{ ['filterEstate','filterDivisi','filterMandor','filterStart','filterEnd'].forEach(id=>$('#'+id).value=''); renderDb(); });
  }

  async function init(){
    applyTheme(preferredTheme());
    fillFormDefaults();
    initEvents();
    await bootstrapOnline();
    renderAll();
    if(!isLoggedIn()) openModal('loginModal');
  }
  document.addEventListener('DOMContentLoaded', init);
})();
