(function(){
  'use strict';

  var STORAGE_KEY = 'sp_app_v2';
  var THEME_KEY = 'sp_theme_v2';
  var DEFAULT_SETTINGS = {
    gasUrl: 'https://script.google.com/macros/s/AKfycbxy-ERQsMybRvnEtsUIk_oEqDBUwfswEp74cWsjVhNzAYeLb3vEo23nnhSUiScWagfH/exec',
    sheetId: '1B6KmlUCOKGozN6abEhp7nzpJMMm1BylBA-tKIrGZBSA',
    defaultTheme: 'light'
  };
  var DEFAULT_ADMIN = {
    id: 'USR-TC001', nip: 'TC001', name: 'ADMIN', role: 'ADMIN', estate: '', divisi: '', pin: '1234', active: true,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), synced: false
  };
  var DEFAULT_STATE = {
    settings: DEFAULT_SETTINGS,
    session: { isLoggedIn: false, userId: '', deviceId: '' },
    users: [DEFAULT_ADMIN], estates: [], peserta: [], mentors: [], reports: []
  };

  function $(s, r){ return (r || document).querySelector(s); }
  function $$(s, r){ return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function clone(v){ return JSON.parse(JSON.stringify(v)); }
  function uid(prefix){ return prefix + '-' + Math.random().toString(36).slice(2,8).toUpperCase() + '-' + Date.now().toString(36).toUpperCase(); }
  function nowISO(){ return new Date().toISOString(); }
  function todayISO(){ var d = new Date(); return d.getFullYear() + '-' + pad2(d.getMonth()+1) + '-' + pad2(d.getDate()); }
  function pad2(n){ return String(n).padStart(2,'0'); }
  function esc(s){ return String(s || '').replace(/[&<>"']/g, function(m){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]; }); }
  function toUpperTrim(v){ return String(v || '').trim().toUpperCase(); }
  function normalizeDivisiCode(val){ return toUpperTrim(val).replace(/\s+/g,''); }
  function parseDivisiCode(code){ var m = normalizeDivisiCode(code).match(/^([A-Z]+)(\d+)$/); return m ? { estate:m[1], divisi:m[2] } : { estate:'', divisi:'' }; }
  function unique(arr){ return arr.filter(function(v,i,a){ return v && a.indexOf(v) === i; }); }
  function listFromText(text){ return unique(String(text || '').split(/[;,\n]+/).map(function(x){ return x.trim(); }).filter(Boolean)); }
  function monthLabel(ym){ if(!ym) return '-'; var p=String(ym).split('-'); if(p.length<2) return ym; return new Intl.DateTimeFormat('id-ID',{month:'long',year:'numeric'}).format(new Date(Number(p[0]), Number(p[1])-1, 1)); }

  function getOrCreateDeviceId(){ var k='sp_device_id_v2'; var v=localStorage.getItem(k); if(!v){ v=uid('DEV'); localStorage.setItem(k,v); } return v; }

  function loadState(){
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if(!raw) return clone(DEFAULT_STATE);
      var parsed = JSON.parse(raw);
      var state = {
        settings: merge(DEFAULT_SETTINGS, parsed.settings || {}),
        session: merge(DEFAULT_STATE.session, parsed.session || {}),
        users: Array.isArray(parsed.users) && parsed.users.length ? parsed.users : [clone(DEFAULT_ADMIN)],
        estates: Array.isArray(parsed.estates) ? parsed.estates : [],
        peserta: Array.isArray(parsed.peserta) ? parsed.peserta : [],
        mentors: Array.isArray(parsed.mentors) ? parsed.mentors : [],
        reports: Array.isArray(parsed.reports) ? parsed.reports : []
      };
      var idx = state.users.findIndex(function(u){ return String(u.nip).toUpperCase() === 'TC001'; });
      if(idx >= 0){ state.users[idx] = merge(state.users[idx], clone(DEFAULT_ADMIN)); state.users[idx].role = 'ADMIN'; state.users[idx].nip = 'TC001'; }
      else state.users.unshift(clone(DEFAULT_ADMIN));
      return state;
    } catch(e){ return clone(DEFAULT_STATE); }
  }
  function merge(a,b){ var o={}; Object.keys(a||{}).forEach(function(k){ o[k]=a[k]; }); Object.keys(b||{}).forEach(function(k){ o[k]=b[k]; }); return o; }

  var State = loadState();
  if(!State.session.deviceId) State.session.deviceId = getOrCreateDeviceId();

  function saveState(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(State)); renderAll(); }
  function currentUser(){ return State.users.filter(function(x){ return x.id === State.session.userId; })[0] || null; }
  function isLoggedIn(){ return !!State.session.isLoggedIn && !!currentUser(); }
  function hasGlobalAccess(u){ u = u || currentUser(); return !!u && (u.role === 'ADMIN' || u.role === 'TC_HEAD'); }
  function isAdmin(){ var u=currentUser(); return !!u && u.role === 'ADMIN'; }
  function canSeeKpi(){ var u=currentUser(); return !!u && (u.role === 'ADMIN' || u.role === 'TC_HEAD'); }
  function isMandor(){ var u=currentUser(); return !!u && u.role === 'MANDOR'; }

  function formatLongDate(iso){
    if(!iso) return '';
    var d = new Date(String(iso).length <= 10 ? iso + 'T00:00:00' : iso);
    return new Intl.DateTimeFormat('id-ID',{ weekday:'long', day:'numeric', month:'long', year:'numeric' }).format(d).replace(/^./, function(m){ return m.toUpperCase(); });
  }
  function formatShortDate(iso){
    if(!iso) return '';
    var d = new Date(String(iso).length <= 10 ? iso + 'T00:00:00' : iso);
    return pad2(d.getDate()) + '/' + pad2(d.getMonth()+1) + '/' + d.getFullYear();
  }
  function userScopeLabel(u){
    u = u || currentUser();
    if(!u) return 'Belum login';
    if(u.role === 'ADMIN' || u.role === 'TC_HEAD') return 'SEMUA ESTATE';
    if(u.role === 'MANAGER') return u.estate || '-';
    return (u.estate || '') + (u.divisi || '') || '-';
  }
  function setStatus(text, kind){
    var el = $('#statusPill'); if(!el) return;
    el.textContent = text;
    el.style.background = kind === 'ok' ? 'rgba(22,163,74,.18)' : kind === 'no' ? 'rgba(220,38,38,.18)' : 'rgba(249,115,22,.18)';
  }
  function applyTheme(theme){
    var t = theme || State.settings.defaultTheme || 'light';
    document.body.classList.toggle('dark', t === 'dark');
    try { localStorage.setItem(THEME_KEY, t); } catch(e) {}
    if($('#btnTheme')) $('#btnTheme').textContent = t === 'dark' ? '☀️' : '🌙';
  }
  function preferredTheme(){ return localStorage.getItem(THEME_KEY) || State.settings.defaultTheme || 'light'; }
  function openModal(id){ var el=document.getElementById(id); if(el) el.classList.add('open'); }
  function closeModal(id){ var el=document.getElementById(id); if(el) el.classList.remove('open'); }
  function copyText(text){
    if(!text) return setStatus('Tidak ada teks untuk disalin.','no');
    if(navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(text).then(function(){ setStatus('Teks berhasil disalin.','ok'); }).catch(function(){ fallbackCopy(text); }); }
    else fallbackCopy(text);
  }
  function fallbackCopy(text){
    var ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); setStatus('Teks berhasil disalin.','ok'); } catch(e){ setStatus('Gagal menyalin teks.','no'); }
    ta.remove();
  }

  function canSeeReport(r, user){
    user = user || currentUser();
    if(!user) return false;
    if(user.role === 'ADMIN' || user.role === 'TC_HEAD') return true;
    if(user.role === 'MANAGER') return r.estate === user.estate;
    if(user.role === 'ASISTEN') return r.estate === user.estate && String(r.divisi) === String(user.divisi);
    return String(r.createdBy && r.createdBy.userId || '') === String(user.id);
  }
  function scopedReports(user){ return State.reports.filter(function(r){ return canSeeReport(r, user); }); }
  function scopedPeserta(user){
    user = user || currentUser();
    if(!user) return [];
    if(hasGlobalAccess(user)) return State.peserta.slice();
    if(user.role === 'MANAGER') return State.peserta.filter(function(p){ return p.estate === user.estate; });
    return State.peserta.filter(function(p){ return p.estate === user.estate && String(p.divisi) === String(user.divisi); });
  }
  function scopedMentors(user){
    user = user || currentUser();
    if(!user) return [];
    if(hasGlobalAccess(user)) return State.mentors.slice();
    if(user.role === 'MANAGER') return State.mentors.filter(function(m){ return m.estate === user.estate; });
    return State.mentors.filter(function(m){ return m.estate === user.estate && String(m.divisi) === String(user.divisi); });
  }
  function canSeeUser(item, user){
    user = user || currentUser();
    if(!user) return false;
    if(hasGlobalAccess(user)) return true;
    return item.estate === user.estate || item.role === 'ADMIN' || item.role === 'TC_HEAD';
  }

  function getFormData(){
    var divisiCode = normalizeDivisiCode($('#divisiCode').value);
    var parsed = parseDivisiCode(divisiCode);
    var user = currentUser() || {};
    var existingId = $('#btnSave').getAttribute('data-edit-id') || '';
    return {
      id: existingId || uid('RPT'),
      createdAt: existingId ? (findById(State.reports, existingId) || {}).createdAt || nowISO() : nowISO(),
      updatedAt: nowISO(),
      tanggal: $('#tanggal').value,
      hariTeks: $('#hariTeks').value,
      divisiCode: divisiCode,
      estate: parsed.estate,
      divisi: parsed.divisi,
      mandorName: toUpperTrim($('#mandorName').value),
      hadirCount: Number($('#hadirCount').value || 0),
      tidakHadirCount: Number($('#tidakHadirCount').value || 0),
      ketidakhadiran: $('#ketidakhadiran').value.trim(),
      materi: $('#materi').value.trim(),
      mentorAktif: Number($('#mentorAktif').value || 0),
      lokasi: $('#lokasi').value.trim(),
      pesertaBaik: $('#pesertaBaik').value.trim(),
      pesertaBina: $('#pesertaBina').value.trim(),
      catatanTeknis: $('#catatanTeknis').value.trim(),
      kendala: $('#kendala').value.trim(),
      tindakLanjut: $('#tindakLanjut').value.trim(),
      synced: false,
      syncedAt: '',
      createdBy: { userId: user.id || '', name: user.name || '', role: user.role || '', estate: user.estate || '', divisi: user.divisi || '', nip: user.nip || '', deviceId: State.session.deviceId }
    };
  }
  function validateReport(r){
    if(!isLoggedIn()) return 'Silakan login dahulu.';
    if(!isMandor() && !isAdmin()) return 'Hanya role MANDOR atau ADMIN yang dapat input laporan.';
    if(!r.tanggal) return 'Tanggal wajib diisi.';
    if(!r.divisiCode || !r.estate || !r.divisi) return 'Divisi wajib format seperti BTUE3.';
    if(!r.mandorName) return 'Nama mandor wajib diisi.';
    return '';
  }
  function fillFormDefaults(){
    var u = currentUser() || {};
    if($('#tanggal')) $('#tanggal').value = todayISO();
    if($('#hariTeks')) $('#hariTeks').value = formatLongDate(todayISO());
    if(u.role === 'MANDOR'){
      if($('#mandorName')) $('#mandorName').value = u.name || '';
      if(u.estate && u.divisi && $('#divisiCode')) $('#divisiCode').value = u.estate + u.divisi;
    }
    if($('#rekapDate')) $('#rekapDate').value = todayISO();
    if($('#monthlyMonth')) $('#monthlyMonth').value = todayISO().slice(0,7);
    if($('#rekapEstate')) $('#rekapEstate').value = hasGlobalAccess(u) ? '' : (u.estate || '');
    if($('#monthlyEstate')) $('#monthlyEstate').value = hasGlobalAccess(u) ? '' : (u.estate || '');
  }
  function resetForm(){
    ['tanggal','hariTeks','divisiCode','mandorName','hadirCount','tidakHadirCount','ketidakhadiran','materi','mentorAktif','lokasi','pesertaBaik','pesertaBina','catatanTeknis','kendala','tindakLanjut','waPreview'].forEach(function(id){ if($('#'+id)) $('#'+id).value=''; });
    $('#btnSave').removeAttribute('data-edit-id');
    $('#btnSave').textContent = 'Simpan';
    fillFormDefaults();
  }
  function buildMandorWA(r){
    return [
      'Laporan Harian Sekolah Panen',
      'Hari/Tanggal: ' + formatLongDate(r.tanggal),
      'Divisi: ' + r.divisiCode,
      'Mandor: ' + r.mandorName,'',
      'Kehadiran:','Peserta hadir: ' + r.hadirCount + ' orang','Peserta tidak hadir: ' + r.tidakHadirCount + ' orang','Keterangan ketidakhadiran: ' + (r.ketidakhadiran || '-'),'',
      'Kegiatan Hari Ini:','Materi: ' + (r.materi || '-'),'Mentor aktif: ' + (r.mentorAktif || 0) + ' orang','Lokasi : ' + (r.lokasi || '-'),'',
      'Hasil Pemantauan:','Peserta yang menunjukkan perkembangan baik: ' + (r.pesertaBaik || '-'),'Peserta yang masih perlu pembinaan: ' + (r.pesertaBina || '-'),'Catatan teknis di lapangan: ' + (r.catatanTeknis || '-'),'',
      'Kendala Hari Ini:', r.kendala || '-','',
      'Rencana Tindak Lanjut Besok:', r.tindakLanjut || '-','',
      'Demikian dan terima kasih.'
    ].join('\n');
  }

  function aggregateReports(reports){
    return {
      countReports: reports.length,
      estateList: unique(reports.map(function(r){ return r.estate; }).filter(Boolean)),
      divisiList: unique(reports.map(function(r){ return r.divisiCode; }).filter(Boolean)),
      mandorList: unique(reports.map(function(r){ return r.mandorName; }).filter(Boolean)),
      hadir: reports.reduce(function(s,r){ return s + Number(r.hadirCount || 0); }, 0),
      tidakHadir: reports.reduce(function(s,r){ return s + Number(r.tidakHadirCount || 0); }, 0),
      mentorAktif: reports.reduce(function(s,r){ return s + Number(r.mentorAktif || 0); }, 0),
      materiList: unique([].concat.apply([], reports.map(function(r){ return listFromText(r.materi); }))),
      lokasiList: unique([].concat.apply([], reports.map(function(r){ return listFromText(r.lokasi); }))),
      binaList: unique([].concat.apply([], reports.map(function(r){ return listFromText(r.pesertaBina); }))),
      kendalaList: unique([].concat.apply([], reports.map(function(r){ return listFromText(r.kendala); }))),
      tindakList: unique([].concat.apply([], reports.map(function(r){ return listFromText(r.tindakLanjut); })))
    };
  }
  function filterForRekap(date, role){
    var reports = scopedReports().filter(function(r){ return !date || r.tanggal === date; });
    var user = currentUser();
    var estate = toUpperTrim($('#rekapEstate') ? $('#rekapEstate').value : '');
    if(estate && hasGlobalAccess(user)) reports = reports.filter(function(r){ return r.estate === estate; });
    if(role === 'ASISTEN' && user && !hasGlobalAccess(user)) reports = reports.filter(function(r){ return r.estate === user.estate && String(r.divisi) === String(user.divisi); });
    if(role === 'MANAGER' && user && !hasGlobalAccess(user)) reports = reports.filter(function(r){ return r.estate === user.estate; });
    return reports;
  }
  function buildAsistenWA(date, reports){
    var agg = aggregateReports(reports);
    return [
      'Laporan Harian Sekolah Panen - Asisten', 'Hari/Tanggal: ' + formatLongDate(date), 'Divisi: ' + (agg.divisiList.join(', ') || '-'), '',
      'Hadir: ' + agg.hadir + ' orang', 'Tidak Hadir: ' + agg.tidakHadir + ' orang', 'Kegiatan: ' + (agg.materiList.join(', ') || '-'), 'Temuan: Peserta perlu pembinaan: ' + (agg.binaList.join(', ') || '-'), 'Kendala: ' + (agg.kendalaList.join('; ') || '-'), 'Tindak Lanjut: ' + (agg.tindakList.join('; ') || '-')
    ].join('\n');
  }
  function buildManagerWA(date, reports){
    var agg = aggregateReports(reports);
    return [
      'Laporan Harian Sekolah Panen - Manager Kebun', 'Hari/Tanggal: ' + formatLongDate(date), 'Estate: ' + (agg.estateList.join(', ') || '-'), '',
      'Hadir: ' + agg.hadir + ' orang', 'Tidak Hadir: ' + agg.tidakHadir + ' orang', 'Divisi terlapor: ' + (agg.divisiList.join(', ') || '-'), 'Kegiatan: ' + (agg.materiList.join(', ') || '-'), 'Kendala: ' + (agg.kendalaList.join('; ') || '-'), 'Tindak Lanjut: ' + (agg.tindakList.join('; ') || '-')
    ].join('\n');
  }
  function buildTcHeadWA(date, reports){
    var agg = aggregateReports(reports);
    return [
      'Laporan Harian Sekolah Panen - TC Head', 'Hari/Tanggal: ' + formatLongDate(date), '',
      'Estate terlapor: ' + (agg.estateList.join(', ') || '-'), 'Divisi terlapor: ' + (agg.divisiList.join(', ') || '-'), 'Total laporan: ' + agg.countReports, 'Peserta hadir: ' + agg.hadir + ' orang', 'Peserta tidak hadir: ' + agg.tidakHadir + ' orang', 'Kegiatan utama: ' + (agg.materiList.join(', ') || '-'), 'Kendala utama: ' + (agg.kendalaList.join('; ') || '-'), 'Tindak lanjut: ' + (agg.tindakList.join('; ') || '-')
    ].join('\n');
  }
  function buildRekapText(){
    var date = $('#rekapDate').value;
    var role = $('#rekapRole').value;
    var reports = filterForRekap(date, role);
    if(!reports.length) throw new Error('Belum ada data rekap pada filter tersebut.');
    if(role === 'ASISTEN') return buildAsistenWA(date, reports);
    if(role === 'MANAGER') return buildManagerWA(date, reports);
    return buildTcHeadWA(date, reports);
  }
  function buildMonthlySummary(){
    var ym = ($('#monthlyMonth').value || '').trim();
    var estate = toUpperTrim($('#monthlyEstate').value);
    var divisi = toUpperTrim($('#monthlyDivisi').value);
    var rows = scopedReports().filter(function(r){ return String(r.tanggal || '').slice(0,7) === ym; });
    var user = currentUser();
    if(estate){ rows = rows.filter(function(r){ return r.estate === estate; }); }
    if(divisi){ rows = rows.filter(function(r){ return String(r.divisi) === divisi || r.divisiCode === estate + divisi; }); }
    if(!hasGlobalAccess(user)){
      if(user.role === 'MANAGER') rows = rows.filter(function(r){ return r.estate === user.estate; });
      else rows = rows.filter(function(r){ return r.estate === user.estate && String(r.divisi) === String(user.divisi); });
    }
    if(!rows.length) throw new Error('Belum ada data bulanan pada filter tersebut.');
    var map = {};
    rows.forEach(function(r){
      var key = r.estate + '|' + r.divisi;
      if(!map[key]) map[key] = { estate:r.estate, divisi:r.divisi, divisiCode:r.divisiCode, laporan:0, hadir:0, tidak:0, mentor:0, mandor:[] };
      map[key].laporan += 1; map[key].hadir += Number(r.hadirCount || 0); map[key].tidak += Number(r.tidakHadirCount || 0); map[key].mentor += Number(r.mentorAktif || 0);
      if(map[key].mandor.indexOf(r.mandorName) === -1) map[key].mandor.push(r.mandorName);
    });
    var lines = ['Rekap Bulanan Sekolah Panen', 'Bulan: ' + monthLabel(ym), ''];
    Object.keys(map).sort().forEach(function(k, idx){ var a = map[k]; lines.push((idx+1) + '. ' + a.divisiCode); lines.push('   Laporan: ' + a.laporan + ' hari'); lines.push('   Hadir: ' + a.hadir + ' orang'); lines.push('   Tidak hadir: ' + a.tidak + ' orang'); lines.push('   Mentor aktif akumulatif: ' + a.mentor + ' orang'); lines.push('   Mandor pelapor: ' + (a.mandor.join(', ') || '-')); lines.push(''); });
    return lines.join('\n');
  }

  function addOrUpdate(arr, item, keyField){
    keyField = keyField || 'id';
    var keyVal = item[keyField];
    var idx = -1;
    for(var i=0;i<arr.length;i++) if(String(arr[i][keyField]) === String(keyVal)) { idx=i; break; }
    if(idx >= 0) arr[idx] = merge(arr[idx], item); else arr.push(item);
  }
  function findById(arr, id){ for(var i=0;i<arr.length;i++) if(String(arr[i].id) === String(id)) return arr[i]; return null; }
  function removeById(arr, id){ var i=arr.findIndex(function(x){ return String(x.id) === String(id); }); if(i>=0) arr.splice(i,1); }

  function autoMapPesertaMentor(){
    var mentorsByDiv = {};
    State.mentors.filter(function(m){ return !!m.active; }).forEach(function(m){
      var key = normalizeDivisiCode(m.divisiCode || (m.estate + m.divisi));
      if(!mentorsByDiv[key]) mentorsByDiv[key] = [];
      mentorsByDiv[key].push(m);
    });
    var counter = {};
    State.peserta.forEach(function(p){
      var key = normalizeDivisiCode(p.divisiCode || (p.estate + p.divisi));
      var list = mentorsByDiv[key] || [];
      if(!list.length) return;
      var matched = list.some(function(m){ return String(m.nip) === String(p.mentorNip); });
      if(!matched){
        counter[key] = counter[key] || 0;
        var mentor = list[counter[key] % list.length];
        counter[key] += 1;
        p.mentorNip = mentor.nip;
        p.synced = false;
        p.updatedAt = nowISO();
      }
    });
  }

  function saveUser(){
    if(!isAdmin()) return setStatus('Hanya ADMIN yang dapat mengelola master user.','no');
    var nip = toUpperTrim($('#userNip').value); if(!nip) return setStatus('NIP user wajib diisi.','no');
    var role = $('#userRole').value || 'MANDOR';
    var item = {
      id: 'USR-' + nip, nip:nip, name: toUpperTrim($('#userName').value), role: role,
      estate: toUpperTrim($('#userEstate').value), divisi: String($('#userDivisi').value || '').trim(), pin: String($('#userPin').value || '').trim(),
      active: true, createdAt: nowISO(), updatedAt: nowISO(), synced:false
    };
    addOrUpdate(State.users, item, 'id'); saveState(); setStatus('User disimpan.','ok'); resetUserForm();
  }
  function saveEstate(){
    if(!isAdmin()) return setStatus('Hanya ADMIN yang dapat mengelola master estate/divisi.','no');
    var code = toUpperTrim($('#estateCode').value), div = String($('#estateDivisi').value || '').trim(); if(!code || !div) return setStatus('Kode estate dan divisi wajib diisi.','no');
    var item = { id:'EST-' + code + div, code:code, name:$('#estateName').value.trim(), divisi:div, divisiCode:code + div, manager:$('#estateManager').value.trim(), active:true, createdAt:nowISO(), updatedAt:nowISO(), synced:false, estate:code };
    addOrUpdate(State.estates, item, 'id'); saveState(); setStatus('Estate/divisi disimpan.','ok'); resetEstateForm();
  }
  function savePeserta(){
    if(!isAdmin()) return setStatus('Master data hanya dapat dibuka oleh ADMIN.','no');
    var nip = toUpperTrim($('#pesertaNip').value), divisiCode = normalizeDivisiCode($('#pesertaDivisiCode').value), parsed = parseDivisiCode(divisiCode);
    if(!nip || !divisiCode || !parsed.estate) return setStatus('Data peserta belum lengkap.','no');
    var item = { id:'PST-' + nip, nip:nip, name:toUpperTrim($('#pesertaName').value), gender:$('#pesertaGender').value || 'L', divisiCode:divisiCode, estate:parsed.estate, divisi:parsed.divisi, mentorNip:toUpperTrim($('#pesertaMentorNip').value), active:true, createdAt:nowISO(), updatedAt:nowISO(), synced:false };
    addOrUpdate(State.peserta, item, 'id'); autoMapPesertaMentor(); saveState(); setStatus('Peserta disimpan.','ok'); resetPesertaForm();
  }
  function saveMentor(){
    if(!isAdmin()) return setStatus('Master data hanya dapat dibuka oleh ADMIN.','no');
    var nip = toUpperTrim($('#mentorNip').value), divisiCode = normalizeDivisiCode($('#mentorDivisiCode').value), parsed = parseDivisiCode(divisiCode);
    if(!nip || !divisiCode || !parsed.estate) return setStatus('Data mentor belum lengkap.','no');
    var item = { id:'MTR-' + nip, nip:nip, name:toUpperTrim($('#mentorName').value), divisiCode:divisiCode, estate:parsed.estate, divisi:parsed.divisi, active:$('#mentorActive').value === 'TRUE', createdAt:nowISO(), updatedAt:nowISO(), synced:false };
    addOrUpdate(State.mentors, item, 'id'); autoMapPesertaMentor(); saveState(); setStatus('Mentor disimpan.','ok'); resetMentorForm();
  }

  function resetUserForm(){ ['userNip','userName','userEstate','userDivisi','userPin'].forEach(function(id){ if($('#'+id)) $('#'+id).value=''; }); if($('#userRole')) $('#userRole').value='MANDOR'; }
  function resetEstateForm(){ ['estateCode','estateName','estateDivisi','estateManager'].forEach(function(id){ if($('#'+id)) $('#'+id).value=''; }); }
  function resetPesertaForm(){ ['pesertaNip','pesertaName','pesertaDivisiCode','pesertaMentorNip'].forEach(function(id){ if($('#'+id)) $('#'+id).value=''; }); if($('#pesertaGender')) $('#pesertaGender').value='L'; }
  function resetMentorForm(){ ['mentorNip','mentorName','mentorDivisiCode'].forEach(function(id){ if($('#'+id)) $('#'+id).value=''; }); if($('#mentorActive')) $('#mentorActive').value='TRUE'; }

  function login(){
    var nip = toUpperTrim($('#loginNip').value), pin = String($('#loginPin').value || '').trim();
    var user = State.users.filter(function(u){ return String(u.nip).toUpperCase() === nip && String(u.pin) === pin && u.active !== false; })[0];
    if(!user) return setStatus('NIP atau PIN tidak valid.','no');
    State.session.isLoggedIn = true; State.session.userId = user.id; saveState(); closeModal('loginModal'); fillFormDefaults(); setStatus('Login berhasil sebagai ' + user.role + '.','ok');
  }
  function logout(){ State.session.isLoggedIn = false; State.session.userId=''; saveState(); openModal('loginModal'); setStatus('Logout berhasil.','ok'); }

  async function jsonRequest(payload){
    var gasUrl = (State.settings.gasUrl || '').trim();
    if(!gasUrl) throw new Error('GAS URL belum diisi.');
    payload = payload || {};
    payload.sheetId = payload.sheetId || State.settings.sheetId;
    try {
      var fetchOpts = { method:'POST', headers:{ 'Content-Type':'text/plain;charset=utf-8' }, body: JSON.stringify(payload), redirect:'follow' };
      var resp = await fetch(gasUrl, fetchOpts);
      var text = await resp.text();
      try { return JSON.parse(text); } catch(e) {}
    } catch(e1) {}
    return await jsonpRequest(payload);
  }
  function jsonpRequest(payload){
    return new Promise(function(resolve, reject){
      var gasUrl = (State.settings.gasUrl || '').trim();
      if(!gasUrl) return reject(new Error('GAS URL belum diisi.'));
      var cb = 'jsonp_cb_' + Date.now() + '_' + Math.random().toString(36).slice(2,8);
      var sep = gasUrl.indexOf('?') >= 0 ? '&' : '?';
      var url = gasUrl + sep + 'callback=' + encodeURIComponent(cb) + '&data=' + encodeURIComponent(JSON.stringify(payload));
      var script = document.createElement('script');
      var timer = setTimeout(function(){ cleanup(); reject(new Error('Timeout saat menghubungi Apps Script.')); }, 25000);
      function cleanup(){ clearTimeout(timer); try{ delete window[cb]; }catch(e){ window[cb] = undefined; } if(script.parentNode) script.parentNode.removeChild(script); }
      window[cb] = function(data){ cleanup(); resolve(data); };
      script.onerror = function(){ cleanup(); reject(new Error('Gagal memanggil Apps Script via JSONP.')); };
      script.src = url; document.body.appendChild(script);
    });
  }

  async function setupSheets(){ var resp = await jsonRequest({ action:'setupWorkbook' }); $('#settingsResult').textContent = resp.success ? ('OK: ' + resp.message) : ('Gagal: ' + resp.message); if(resp.success) setStatus('Sheet berhasil dicek/dibuat.','ok'); }
  async function testConnection(){ var resp = await jsonRequest({ action:'testConnection' }); $('#settingsResult').textContent = resp.success ? ('OK: ' + resp.message) : ('Gagal: ' + resp.message); }
  async function syncAll(){
    if(!isLoggedIn()) return setStatus('Silakan login dahulu.','no');
    autoMapPesertaMentor();
    var payload = { action:'syncAll', timestamp: nowISO(), reports: State.reports.filter(function(x){ return !x.synced; }), users: State.users.filter(function(x){ return !x.synced; }), estates: State.estates.filter(function(x){ return !x.synced; }), peserta: State.peserta.filter(function(x){ return !x.synced; }), mentors: State.mentors.filter(function(x){ return !x.synced; }), settings: State.settings };
    var resp = await jsonRequest(payload);
    if(!resp.success) throw new Error(resp.message || 'Sync gagal.');
    ['reports','users','estates','peserta','mentors'].forEach(function(key){ State[key] = State[key].map(function(item){ item.synced = true; item.syncedAt = nowISO(); return item; }); });
    saveState(); setStatus('Sync berhasil.','ok');
  }
  async function pullAll(){
    if(!isLoggedIn()) return setStatus('Silakan login dahulu.','no');
    var resp = await jsonRequest({ action:'pullAll', profile: currentUser() });
    if(!resp.success) throw new Error(resp.message || 'Pull gagal.');
    ['users','estates','peserta','mentors','reports'].forEach(function(key){
      if(!Array.isArray(resp[key])) return;
      var map = {};
      State[key].forEach(function(item){ map[item.id || item.nip || item.divisiCode] = item; });
      resp[key].forEach(function(item){ map[item.id || item.nip || item.divisiCode] = merge(map[item.id || item.nip || item.divisiCode] || {}, item); map[item.id || item.nip || item.divisiCode].synced = true; });
      State[key] = Object.keys(map).map(function(k){ return map[k]; });
    });
    if(resp.settings) State.settings = merge(State.settings, resp.settings);
    autoMapPesertaMentor();
    saveState(); applyTheme(preferredTheme()); setStatus('Pull berhasil.','ok');
  }

  function filteredReports(){
    var rows = scopedReports().slice();
    var estate = toUpperTrim($('#filterEstate') ? $('#filterEstate').value : '');
    var divisi = String($('#filterDivisi') ? $('#filterDivisi').value : '').trim();
    var mandor = toUpperTrim($('#filterMandor') ? $('#filterMandor').value : '');
    var start = $('#filterStart') ? $('#filterStart').value : '';
    var end = $('#filterEnd') ? $('#filterEnd').value : '';
    if(estate) rows = rows.filter(function(r){ return r.estate === estate; });
    if(divisi) rows = rows.filter(function(r){ return String(r.divisi) === divisi || r.divisiCode === estate + divisi; });
    if(mandor) rows = rows.filter(function(r){ return String(r.mandorName || '').indexOf(mandor) >= 0; });
    if(start) rows = rows.filter(function(r){ return String(r.tanggal) >= start; });
    if(end) rows = rows.filter(function(r){ return String(r.tanggal) <= end; });
    return rows.sort(function(a,b){ return String(b.tanggal).localeCompare(String(a.tanggal)) || String(b.createdAt||'').localeCompare(String(a.createdAt||'')); });
  }

  function exportExcel(){
    var rows = filteredReports();
    if(!rows.length) return setStatus('Tidak ada data untuk diexport.','no');
    var wb = XLSX.utils.book_new();
    var aoa = [['Tanggal','Divisi','Estate','Mandor','Hadir','Tidak Hadir','Ketidakhadiran','Materi','Mentor Aktif','Lokasi','Peserta Baik','Perlu Pembinaan','Catatan Teknis','Kendala','Tindak Lanjut']];
    rows.forEach(function(r){ aoa.push([formatShortDate(r.tanggal), r.divisiCode, r.estate, r.mandorName, r.hadirCount, r.tidakHadirCount, r.ketidakhadiran, r.materi, r.mentorAktif, r.lokasi, r.pesertaBaik, r.pesertaBina, r.catatanTeknis, r.kendala, r.tindakLanjut]); });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'Laporan');
    var monthText = ($('#monthlyPreview') && $('#monthlyPreview').value) ? $('#monthlyPreview').value.split('\n').map(function(l){ return [l]; }) : [['']];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(monthText), 'Rekap Bulanan');
    XLSX.writeFile(wb, 'sekolah_pemanen_export.xlsx');
    setStatus('Excel berhasil dibuat.','ok');
  }
  function exportPdf(){
    var rows = filteredReports();
    if(!rows.length) return setStatus('Tidak ada data untuk diexport.','no');
    var jsPDFCtor = window.jspdf && window.jspdf.jsPDF ? window.jspdf.jsPDF : window.jsPDF;
    var doc = new jsPDFCtor({ orientation:'landscape', unit:'mm', format:'a4' });
    doc.setFontSize(16); doc.text('Laporan Manajemen Sekolah Pemanen', 14, 14);
    doc.setFontSize(9); doc.text('Dicetak: ' + formatLongDate(todayISO()) + ' • Scope: ' + userScopeLabel(), 14, 20);
    if(doc.autoTable){
      var body = rows.map(function(r){ return [formatShortDate(r.tanggal), r.divisiCode, r.mandorName, String(r.hadirCount), String(r.tidakHadirCount), r.materi || '-', r.kendala || '-', r.tindakLanjut || '-']; });
      doc.autoTable({ startY: 24, head: [['Tanggal','Divisi','Mandor','Hadir','Tidak Hadir','Materi','Kendala','Tindak Lanjut']], body: body, styles:{ fontSize:8, cellPadding:2 }, headStyles:{ fillColor:[249,115,22] } });
      var nextY = doc.lastAutoTable.finalY + 10;
      var monthly = ($('#monthlyPreview') && $('#monthlyPreview').value) ? $('#monthlyPreview').value : '';
      if(monthly){ doc.setFontSize(12); doc.text('Rekap Bulanan', 14, nextY); doc.setFontSize(9); doc.text(doc.splitTextToSize(monthly, 260), 14, nextY + 6); }
    }
    doc.save('laporan_manajemen_sekolah_pemanen.pdf');
    setStatus('PDF berhasil dibuat.','ok');
  }

  function renderAuth(){
    var user = currentUser();
    $('#profileSummary').textContent = user ? (user.role + ' • ' + user.name + ' • Scope: ' + userScopeLabel(user)) : 'Belum login';
    $$('.auth-only').forEach(function(el){ el.classList.toggle('hidden-tab', !isLoggedIn()); });
    $('#btnOpenLogin').classList.toggle('hidden', isLoggedIn());
    $('#btnLogout').classList.toggle('hidden', !isLoggedIn());
  }
  function renderDashboard(){
    var user = currentUser();
    var reports = scopedReports();
    var today = todayISO();
    var peserta = scopedPeserta();
    var mentors = scopedMentors();
    var avgHadir = reports.length ? (reports.reduce(function(s,r){ return s + Number(r.hadirCount||0); },0) / reports.length) : 0;
    var totalPesertaMovement = reports.reduce(function(s,r){ return s + Number(r.hadirCount||0) + Number(r.tidakHadirCount||0); }, 0);
    var absenceRate = totalPesertaMovement ? ((reports.reduce(function(s,r){ return s + Number(r.tidakHadirCount||0); },0) / totalPesertaMovement) * 100) : 0;
    $('#statTotalReports').textContent = String(reports.length);
    $('#statTodayReports').textContent = String(reports.filter(function(r){ return r.tanggal === today; }).length);
    $('#statHadir').textContent = String(reports.reduce(function(s,r){ return s + Number(r.hadirCount||0); },0));
    $('#statTidakHadir').textContent = String(reports.reduce(function(s,r){ return s + Number(r.tidakHadirCount||0); },0));
    $('#statPeserta').textContent = String(peserta.length);
    $('#statMentor').textContent = String(mentors.length);
    $('#statUsers').textContent = String(State.users.filter(function(u){ return canSeeUser(u, user); }).length);
    $('#statUnsynced').textContent = String([State.reports,State.users,State.estates,State.peserta,State.mentors].reduce(function(a,b){ return a.concat(b); },[]).filter(function(x){ return !x.synced; }).length);
    $('#scopeInfo').innerHTML = [ ['Role aktif', user ? user.role : '-'], ['Nama user', user ? user.name : '-'], ['Scope', userScopeLabel(user)], ['Device ID', State.session.deviceId] ].map(function(row){ return '<div class="info-row"><span>' + esc(row[0]) + '</span><strong>' + esc(row[1]) + '</strong></div>'; }).join('');
    $('#activityInfo').innerHTML = [ ['Laporan tersimpan', String(reports.length)], ['Rata-rata hadir/laporan', avgHadir.toFixed(1)], ['Rasio tidak hadir', absenceRate.toFixed(1) + '%'], ['Master mapping peserta→mentor', String(State.peserta.filter(function(p){ return !!p.mentorNip; }).length)] ].map(function(row){ return '<div class="info-row"><span>' + esc(row[0]) + '</span><strong>' + esc(row[1]) + '</strong></div>'; }).join('');
    var latest = filteredReports().slice(0,8);
    $('#dashboardRecent').innerHTML = latest.length ? latest.map(function(r){ return '<div class="list-item"><div class="list-title">' + esc(formatLongDate(r.tanggal)) + ' • ' + esc(r.divisiCode) + ' • ' + esc(r.mandorName) + ' <span class="chip ' + (r.synced ? 'ok' : 'no') + '">' + (r.synced ? 'Synced' : 'Local') + '</span></div><div class="list-body">Hadir ' + esc(String(r.hadirCount)) + ' | Tidak hadir ' + esc(String(r.tidakHadirCount)) + '\nMateri: ' + esc(r.materi) + '\nLokasi: ' + esc(r.lokasi) + '</div></div>'; }).join('') : '<div class="small muted">Belum ada laporan.</div>';
    $('#adminKpiWrap').classList.toggle('hidden', !canSeeKpi());
    $('#monthlyWrap').classList.toggle('hidden', !isLoggedIn());
    if(canSeeKpi()) renderKpi();
  }
  function renderKpi(){
    var reports = State.reports.slice();
    var estates = unique(reports.map(function(r){ return r.estate; }).filter(Boolean));
    var divisis = unique(reports.map(function(r){ return r.divisiCode; }).filter(Boolean));
    var avgHadir = reports.length ? (reports.reduce(function(s,r){ return s + Number(r.hadirCount||0); },0) / reports.length) : 0;
    var totalMov = reports.reduce(function(s,r){ return s + Number(r.hadirCount||0) + Number(r.tidakHadirCount||0); },0);
    var absenceRate = totalMov ? (reports.reduce(function(s,r){ return s + Number(r.tidakHadirCount||0); },0) / totalMov * 100) : 0;
    $('#kpiEstateCount').textContent = String(estates.length);
    $('#kpiDivisiCount').textContent = String(divisis.length);
    $('#kpiAvgHadir').textContent = avgHadir.toFixed(1);
    $('#kpiAbsenceRate').textContent = absenceRate.toFixed(1) + '%';
    var mentorMapped = State.peserta.length ? Math.round(State.peserta.filter(function(p){ return !!p.mentorNip; }).length / State.peserta.length * 100) : 0;
    $('#kpiManagementList').innerHTML = [ ['Total peserta termapping mentor', mentorMapped + '%'], ['Total laporan bulan ini', State.reports.filter(function(r){ return String(r.tanggal).slice(0,7) === todayISO().slice(0,7); }).length], ['Estate dengan laporan terbanyak', computeTopEstate().label], ['Divisi dengan rata-rata hadir tertinggi', computeTopDivisi().label] ].map(function(row){ return '<div class="info-row"><span>' + esc(row[0]) + '</span><strong>' + esc(row[1]) + '</strong></div>'; }).join('');
    var ranking = rankEstateDivisi();
    $('#kpiRankingList').innerHTML = ranking.length ? ranking.map(function(r,idx){ return '<div class="list-item"><div class="list-title">#' + (idx+1) + ' • ' + esc(r.label) + '</div><div class="list-meta">Laporan ' + esc(String(r.laporan)) + ' • Hadir ' + esc(String(r.hadir)) + ' • Tidak hadir ' + esc(String(r.tidak)) + '</div><div class="list-body">Skor KPI: ' + esc(r.score.toFixed(1)) + '</div></div>'; }).join('') : '<div class="small muted">Belum ada data KPI.</div>';
  }
  function computeTopEstate(){ var map={}; State.reports.forEach(function(r){ map[r.estate]= (map[r.estate]||0)+1; }); var best={label:'-',val:0}; Object.keys(map).forEach(function(k){ if(map[k]>best.val) best={label:k,val:map[k]}; }); return best; }
  function computeTopDivisi(){ var map={}; State.reports.forEach(function(r){ var k=r.divisiCode; if(!map[k]) map[k]={h:0,l:0}; map[k].h += Number(r.hadirCount||0); map[k].l += 1; }); var best={label:'-',val:0}; Object.keys(map).forEach(function(k){ var v = map[k].l ? map[k].h/map[k].l : 0; if(v>best.val) best={label:k,val:v}; }); return best; }
  function rankEstateDivisi(){ var map={}; State.reports.forEach(function(r){ var k=r.divisiCode; if(!map[k]) map[k]={label:k,laporan:0,hadir:0,tidak:0}; map[k].laporan+=1; map[k].hadir += Number(r.hadirCount||0); map[k].tidak += Number(r.tidakHadirCount||0); }); return Object.keys(map).map(function(k){ var x=map[k]; x.score = x.hadir - (x.tidak * 2) + x.laporan; return x; }).sort(function(a,b){ return b.score - a.score; }).slice(0,10); }

  function renderLists(){
    var user = currentUser();
    var showMaster = isAdmin();
    $('#userList').innerHTML = showMaster ? State.users.map(function(u){ return '<div class="list-item"><div class="list-title">' + esc(u.name) + ' • ' + esc(u.role) + '</div><div class="list-meta">' + esc(u.nip) + ' • ' + esc(userScopeLabel(u)) + '</div></div>'; }).join('') : '<div class="small muted">Master data hanya untuk ADMIN.</div>';
    $('#estateList').innerHTML = showMaster ? State.estates.map(function(e){ return '<div class="list-item"><div class="list-title">' + esc(e.divisiCode) + ' • ' + esc(e.name || e.code) + '</div><div class="list-meta">PIC: ' + esc(e.manager || '-') + '</div></div>'; }).join('') : '<div class="small muted">Master data hanya untuk ADMIN.</div>';
    $('#pesertaList').innerHTML = showMaster ? State.peserta.map(function(p){ return '<div class="list-item"><div class="list-title">' + esc(p.name) + '</div><div class="list-meta">' + esc(p.nip) + ' • ' + esc(p.divisiCode) + ' • Mentor ' + esc(p.mentorNip || '-') + '</div></div>'; }).join('') : '<div class="small muted">Master data hanya untuk ADMIN.</div>';
    $('#mentorList').innerHTML = showMaster ? State.mentors.map(function(m){ return '<div class="list-item"><div class="list-title">' + esc(m.name) + '</div><div class="list-meta">' + esc(m.nip) + ' • ' + esc(m.divisiCode) + ' • ' + (m.active ? 'Aktif' : 'Nonaktif') + '</div></div>'; }).join('') : '<div class="small muted">Master data hanya untuk ADMIN.</div>';
  }
  function renderDb(){
    var reports = filteredReports();
    $('#statTotal').textContent = String(reports.length); $('#statUnsyncedDb').textContent = String(reports.filter(function(r){ return !r.synced; }).length); $('#statRole').textContent = currentUser() ? currentUser().role : '-'; $('#statScope').textContent = userScopeLabel();
    $('#historyList').innerHTML = reports.length ? reports.map(function(r){
      return '<div class="list-item"><div class="list-title">' + esc(formatLongDate(r.tanggal)) + ' • ' + esc(r.divisiCode) + ' • ' + esc(r.mandorName) + '<span class="chip ' + (r.synced ? 'ok' : 'no') + '">' + (r.synced ? 'Synced' : 'Local') + '</span></div><div class="list-meta">' + esc(r.id) + ' • ' + esc(r.createdBy && r.createdBy.name || '-') + '</div><div class="list-body">' + esc(buildMandorWA(r)) + '</div><div class="actions"><button class="btn secondary btn-edit-report" data-id="' + esc(r.id) + '" type="button">Edit</button><button class="btn secondary btn-delete-report" data-id="' + esc(r.id) + '" type="button">Hapus</button></div></div>';
    }).join('') : '<div class="small muted">Belum ada data.</div>';
    $$('.btn-edit-report').forEach(function(btn){ btn.addEventListener('click', function(){ editReport(btn.getAttribute('data-id')); }); });
    $$('.btn-delete-report').forEach(function(btn){ btn.addEventListener('click', function(){ deleteReport(btn.getAttribute('data-id')); }); });
  }
  function editReport(id){
    var r = findById(State.reports, id); if(!r) return;
    activateTab('laporan');
    ['tanggal','hariTeks','divisiCode','mandorName','hadirCount','tidakHadirCount','ketidakhadiran','materi','mentorAktif','lokasi','pesertaBaik','pesertaBina','catatanTeknis','kendala','tindakLanjut'].forEach(function(idf){ if($('#'+idf)) $('#'+idf).value = r[idf] || ''; });
    $('#btnSave').setAttribute('data-edit-id', r.id); $('#btnSave').textContent = 'Update'; $('#waPreview').value = buildMandorWA(r); window.scrollTo({ top:0, behavior:'smooth' });
  }
  function deleteReport(id){ if(!confirm('Hapus laporan ini?')) return; removeById(State.reports, id); saveState(); setStatus('Laporan dihapus.','ok'); }

  function renderPermissions(){
    var user = currentUser();
    var logged = !!user;
    $('#formCard').classList.toggle('hidden', !logged || (user.role !== 'MANDOR' && user.role !== 'ADMIN'));
    $('#master').classList.toggle('hidden', !isAdmin());
    $('#pengaturan').classList.toggle('hidden', !isAdmin());
    var masterTab = document.querySelector('[data-tab="master"]'); if(masterTab) masterTab.classList.toggle('hidden-tab', !isAdmin());
    var settingsTab = document.querySelector('[data-tab="pengaturan"]'); if(settingsTab) settingsTab.classList.toggle('hidden-tab', !isAdmin());
    var dbTab = document.querySelector('[data-tab="database"]'); if(dbTab) dbTab.classList.toggle('hidden-tab', !logged);
    var laporanTab = document.querySelector('[data-tab="laporan"]'); if(laporanTab) laporanTab.classList.toggle('hidden-tab', !logged);
    var rekapTab = document.querySelector('[data-tab="rekap"]'); if(rekapTab) rekapTab.classList.toggle('hidden-tab', !logged);
    if($('#rekapRole')){
      var opts = [];
      if(!user) opts = [];
      else if(user.role === 'ADMIN' || user.role === 'TC_HEAD') opts = ['ASISTEN','MANAGER','TC_HEAD'];
      else if(user.role === 'MANAGER') opts = ['MANAGER'];
      else opts = ['ASISTEN'];
      $('#rekapRole').innerHTML = opts.map(function(v){ return '<option value="' + v + '">' + v + '</option>'; }).join('');
    }
    if($('#scopeHint')) $('#scopeHint').textContent = 'Scope aktif: ' + userScopeLabel(user) + '.';
  }
  function fillSettings(){ if($('#gasUrl')) $('#gasUrl').value = State.settings.gasUrl || ''; if($('#sheetId')) $('#sheetId').value = State.settings.sheetId || ''; if($('#defaultTheme')) $('#defaultTheme').value = State.settings.defaultTheme || 'light'; }
  function saveSettings(){ if(!isAdmin()) return setStatus('Hanya ADMIN yang dapat menyimpan pengaturan.','no'); State.settings = { gasUrl: ($('#gasUrl').value || '').trim(), sheetId: ($('#sheetId').value || '').trim(), defaultTheme: $('#defaultTheme').value || 'light' }; saveState(); applyTheme(State.settings.defaultTheme); $('#settingsResult').textContent = 'Pengaturan disimpan.'; setStatus('Pengaturan disimpan.','ok'); }
  function renderAll(){ autoMapPesertaMentor(); renderAuth(); renderPermissions(); renderDashboard(); renderLists(); renderDb(); fillSettings(); }
  function activateTab(name){ $$('.tab').forEach(function(x){ x.classList.remove('active'); }); $$('.tab-panel').forEach(function(x){ x.classList.remove('active'); }); var btn=document.querySelector('.tab[data-tab="'+name+'"]'); if(btn) btn.classList.add('active'); var panel=document.getElementById(name); if(panel) panel.classList.add('active'); }

  function initEvents(){
    $$('.tab').forEach(function(btn){ btn.addEventListener('click', function(){ activateTab(btn.getAttribute('data-tab')); }); });
    if($('#tanggal')) $('#tanggal').addEventListener('change', function(){ if($('#hariTeks')) $('#hariTeks').value = formatLongDate($('#tanggal').value); });
    $('#btnTheme').addEventListener('click', function(){ applyTheme(document.body.classList.contains('dark') ? 'light' : 'dark'); });
    $('#btnOpenLogin').addEventListener('click', function(){ openModal('loginModal'); });
    $('#btnLogout').addEventListener('click', logout);
    $('#btnDoLogin').addEventListener('click', login);
    $$('.close-btn,[data-close]').forEach(function(btn){ btn.addEventListener('click', function(){ closeModal(btn.getAttribute('data-close') || 'loginModal'); }); });
    $('#btnSaveUser').addEventListener('click', saveUser); $('#btnResetUser').addEventListener('click', resetUserForm); $('#btnSaveEstate').addEventListener('click', saveEstate); $('#btnResetEstate').addEventListener('click', resetEstateForm); $('#btnSavePeserta').addEventListener('click', savePeserta); $('#btnResetPeserta').addEventListener('click', resetPesertaForm); $('#btnSaveMentor').addEventListener('click', saveMentor); $('#btnResetMentor').addEventListener('click', resetMentorForm);
    $('#btnResetForm').addEventListener('click', resetForm);
    $('#btnSave').addEventListener('click', function(){ var r=getFormData(); var err=validateReport(r); if(err) return setStatus(err,'no'); addOrUpdate(State.reports, r, 'id'); saveState(); $('#waPreview').value=buildMandorWA(r); $('#btnSave').removeAttribute('data-edit-id'); $('#btnSave').textContent='Simpan'; setStatus('Laporan disimpan.','ok'); });
    $('#btnGenerateMandor').addEventListener('click', function(){ var r=getFormData(); var err=validateReport(r); if(err) return setStatus(err,'no'); $('#waPreview').value=buildMandorWA(r); setStatus('Preview WA dibuat.','ok'); });
    $('#btnCopyWA').addEventListener('click', function(){ copyText($('#waPreview').value); });
    $('#btnOpenWA').addEventListener('click', function(){ var text=$('#waPreview').value; if(!text) return setStatus('Preview WA kosong.','no'); window.open('https://wa.me/?text=' + encodeURIComponent(text),'_blank'); });
    $('#btnGenerateRekap').addEventListener('click', function(){ try { $('#rekapPreview').value = buildRekapText(); setStatus('Rekap WA dibuat.','ok'); } catch(err){ setStatus(err.message,'no'); } });
    $('#btnCopyRekap').addEventListener('click', function(){ copyText($('#rekapPreview').value); });
    $('#btnGenerateMonthly').addEventListener('click', function(){ try { $('#monthlyPreview').value = buildMonthlySummary(); setStatus('Rekap bulanan dibuat.','ok'); } catch(err){ setStatus(err.message,'no'); } });
    $('#btnCopyMonthly').addEventListener('click', function(){ copyText($('#monthlyPreview').value); });
    $('#btnExportExcel').addEventListener('click', exportExcel); $('#btnExportPdf').addEventListener('click', exportPdf);
    $('#btnSaveSettings').addEventListener('click', saveSettings); $('#btnSetupSheets').addEventListener('click', function(){ setupSheets().catch(function(err){ $('#settingsResult').textContent = err.message; }); }); $('#btnTestConnection').addEventListener('click', function(){ testConnection().catch(function(err){ $('#settingsResult').textContent = err.message; }); });
    $('#btnSync').addEventListener('click', function(){ syncAll().catch(function(err){ setStatus(err.message,'no'); }); }); $('#btnPull').addEventListener('click', function(){ pullAll().catch(function(err){ setStatus(err.message,'no'); }); });
    $('#btnResetFilter').addEventListener('click', function(){ ['filterEstate','filterDivisi','filterMandor','filterStart','filterEnd'].forEach(function(id){ if($('#'+id)) $('#'+id).value=''; }); renderDb(); });
    ['filterEstate','filterDivisi','filterMandor','filterStart','filterEnd'].forEach(function(id){ if($('#'+id)) $('#'+id).addEventListener('input', renderDb); });
    $('#loginPin').addEventListener('keydown', function(e){ if(e.key === 'Enter') login(); });
  }

  function init(){ applyTheme(preferredTheme()); fillFormDefaults(); initEvents(); renderAll(); if(!isLoggedIn()) openModal('loginModal'); }
  document.addEventListener('DOMContentLoaded', init);
})();
