function doGet(e){ return handleRequest_(e); }
function doPost(e){ return handleRequest_(e); }

function handleRequest_(e){
  var req = {};
  try {
    if (e && e.parameter && e.parameter.data) req = JSON.parse(e.parameter.data);
    else if (e && e.postData && e.postData.contents) req = JSON.parse(e.postData.contents);
    if (e && e.parameter && e.parameter.callback) req.callback = String(e.parameter.callback);

    switch (String(req.action || '')) {
      case 'testConnection':
        return respond_(true, 'Koneksi berhasil.', { time: new Date().toISOString() }, req);
      case 'setupWorkbook':
        return setupWorkbook_(req);
      case 'syncAll':
        return syncAll_(req);
      case 'pullAll':
        return pullAll_(req);
      default:
        return respond_(false, 'Action tidak dikenal.', null, req);
    }
  } catch (err) {
    return respond_(false, err.message, null, req);
  }
}

function setupWorkbook_(req){
  var ss = SpreadsheetApp.openById(req.sheetId);
  ensureSheets_(ss);
  recalcRecaps_(ss);
  return respond_(true, 'Sheet otomatis berhasil dibuat/dicek.', null, req);
}

function syncAll_(req){
  var ss = SpreadsheetApp.openById(req.sheetId);
  ensureSheets_(ss);

  upsertByKey_(ss.getSheetByName('Users'), req.users || [], 'id', userToRow_);
  upsertByKey_(ss.getSheetByName('MasterEstateDivisi'), req.estates || [], 'id', estateToRow_);
  upsertByKey_(ss.getSheetByName('MasterPeserta'), req.peserta || [], 'id', pesertaToRow_);
  upsertByKey_(ss.getSheetByName('MasterMentor'), req.mentors || [], 'id', mentorToRow_);
  upsertByKey_(ss.getSheetByName('LaporanHarian'), req.reports || [], 'id', reportToRow_);
  saveConfig_(ss.getSheetByName('Config'), req.settings || {});

  appendAudit_(ss.getSheetByName('AuditLog'), 'SYNC_ALL', 'Sinkronisasi data berhasil', req.timestamp || new Date().toISOString());
  recalcRecaps_(ss);
  return respond_(true, 'Sync berhasil.', null, req);
}

function pullAll_(req){
  var ss = SpreadsheetApp.openById(req.sheetId);
  ensureSheets_(ss);
  var profile = req.profile || {};

  var users = readUsers_(ss.getSheetByName('Users'));
  var estates = readEstates_(ss.getSheetByName('MasterEstateDivisi'));
  var peserta = readPeserta_(ss.getSheetByName('MasterPeserta')).filter(function(x){ return canSeeMaster_(x, profile); });
  var mentors = readMentors_(ss.getSheetByName('MasterMentor')).filter(function(x){ return canSeeMaster_(x, profile); });
  var reports = readReports_(ss.getSheetByName('LaporanHarian')).filter(function(x){ return canSeeReport_(x, profile); });

  if (String(profile.role || '').toUpperCase() !== 'TC_HEAD') {
    users = users.filter(function(u){ return canSeeUser_(u, profile); });
    estates = estates.filter(function(e){ return canSeeMaster_(e, profile); });
  }

  return respond_(true, 'Pull berhasil.', {
    users: users,
    estates: estates,
    peserta: peserta,
    mentors: mentors,
    reports: reports,
    settings: readConfig_(ss.getSheetByName('Config'))
  }, req);
}

function ensureSheets_(ss){
  ensureSheet_(ss, 'Users', ['id','nip','name','role','estate','divisi','pin','active','createdAt','updatedAt']);
  ensureSheet_(ss, 'MasterEstateDivisi', ['id','code','name','divisi','divisiCode','manager','active','createdAt','updatedAt']);
  ensureSheet_(ss, 'MasterPeserta', ['id','nip','name','gender','divisiCode','estate','divisi','mentorNip','active','createdAt','updatedAt']);
  ensureSheet_(ss, 'MasterMentor', ['id','nip','name','divisiCode','estate','divisi','active','createdAt','updatedAt']);
  ensureSheet_(ss, 'LaporanHarian', ['id','createdAt','updatedAt','tanggal','hariTeks','divisiCode','estate','divisi','mandorName','hadirCount','tidakHadirCount','ketidakhadiran','materi','mentorAktif','lokasi','pesertaBaik','pesertaBina','catatanTeknis','kendala','tindakLanjut','syncedAt','createdByUserId','createdByName','createdByRole','createdByEstate','createdByDivisi','createdByNip','createdByDeviceId']);
  ensureSheet_(ss, 'RekapAsisten', ['tanggal','estate','divisi','jumlahLaporan','hadir','tidakHadir','mentorAktif','materi','lokasi','kendala','tindakLanjut']);
  ensureSheet_(ss, 'RekapManager', ['tanggal','estate','jumlahLaporan','hadir','tidakHadir','mentorAktif','divisiTerlapor','materi','kendala','tindakLanjut']);
  ensureSheet_(ss, 'RekapTCHead', ['tanggal','jumlahLaporan','estateTerlapor','divisiTerlapor','hadir','tidakHadir','mentorAktif','materi','kendala','tindakLanjut']);
  ensureSheet_(ss, 'RekapBulanan', ['bulan','estate','divisi','divisiCode','jumlahLaporan','hadir','tidakHadir','mentorAktif','mandor']);
  ensureSheet_(ss, 'Config', ['key','value']);
  ensureSheet_(ss, 'AuditLog', ['timestamp','action','message']);
}

function ensureSheet_(ss, name, headers){
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.getRange(1,1,1,headers.length).setValues([headers]);
    sh.getRange(1,1,1,headers.length).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
}

function upsertByKey_(sh, items, keyField, mapper){
  if (!items || !items.length) return;
  var data = sh.getDataRange().getValues();
  var map = {};
  for (var i = 1; i < data.length; i++) map[String(data[i][0] || '')] = i + 1;
  items.forEach(function(item){
    var row = mapper(item);
    var key = String(item[keyField] || '');
    if (!key) return;
    if (map[key]) sh.getRange(map[key], 1, 1, row.length).setValues([row]);
    else sh.appendRow(row);
  });
}

function readRows_(sh){
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2,1,sh.getLastRow()-1,sh.getLastColumn()).getValues();
}
function readUsers_(sh){ return readRows_(sh).map(function(r){ return { id:r[0], nip:r[1], name:r[2], role:r[3], estate:r[4], divisi:String(r[5]||''), pin:r[6], active:toBool_(r[7]), createdAt:r[8], updatedAt:r[9], synced:true }; }); }
function readEstates_(sh){ return readRows_(sh).map(function(r){ return { id:r[0], code:r[1], name:r[2], divisi:String(r[3]||''), divisiCode:r[4], manager:r[5], active:toBool_(r[6]), createdAt:r[7], updatedAt:r[8], estate:r[1] }; }); }
function readPeserta_(sh){ return readRows_(sh).map(function(r){ return { id:r[0], nip:r[1], name:r[2], gender:r[3], divisiCode:r[4], estate:r[5], divisi:String(r[6]||''), mentorNip:r[7], active:toBool_(r[8]), createdAt:r[9], updatedAt:r[10], synced:true }; }); }
function readMentors_(sh){ return readRows_(sh).map(function(r){ return { id:r[0], nip:r[1], name:r[2], divisiCode:r[3], estate:r[4], divisi:String(r[5]||''), active:toBool_(r[6]), createdAt:r[7], updatedAt:r[8], synced:true }; }); }
function readReports_(sh){ return readRows_(sh).map(function(r){ return { id:r[0], createdAt:r[1], updatedAt:r[2], tanggal:toIsoDate_(r[3]), hariTeks:r[4], divisiCode:r[5], estate:r[6], divisi:String(r[7]||''), mandorName:r[8], hadirCount:Number(r[9]||0), tidakHadirCount:Number(r[10]||0), ketidakhadiran:r[11], materi:r[12], mentorAktif:Number(r[13]||0), lokasi:r[14], pesertaBaik:r[15], pesertaBina:r[16], catatanTeknis:r[17], kendala:r[18], tindakLanjut:r[19], syncedAt:r[20], synced:true, createdBy:{ userId:r[21], name:r[22], role:r[23], estate:r[24], divisi:String(r[25]||''), nip:r[26], deviceId:r[27] } }; }); }

function userToRow_(i){ return [i.id||'', i.nip||'', i.name||'', i.role||'', i.estate||'', i.divisi||'', i.pin||'', boolToText_(i.active), i.createdAt||new Date().toISOString(), i.updatedAt||new Date().toISOString()]; }
function estateToRow_(i){ return [i.id||'', i.code||'', i.name||'', i.divisi||'', i.divisiCode||'', i.manager||'', boolToText_(i.active), i.createdAt||new Date().toISOString(), i.updatedAt||new Date().toISOString()]; }
function pesertaToRow_(i){ return [i.id||'', i.nip||'', i.name||'', i.gender||'', i.divisiCode||'', i.estate||'', i.divisi||'', i.mentorNip||'', boolToText_(i.active), i.createdAt||new Date().toISOString(), i.updatedAt||new Date().toISOString()]; }
function mentorToRow_(i){ return [i.id||'', i.nip||'', i.name||'', i.divisiCode||'', i.estate||'', i.divisi||'', boolToText_(i.active), i.createdAt||new Date().toISOString(), i.updatedAt||new Date().toISOString()]; }
function reportToRow_(i){ return [i.id||'', i.createdAt||'', i.updatedAt||'', i.tanggal||'', i.hariTeks||'', i.divisiCode||'', i.estate||'', i.divisi||'', i.mandorName||'', Number(i.hadirCount||0), Number(i.tidakHadirCount||0), i.ketidakhadiran||'', i.materi||'', Number(i.mentorAktif||0), i.lokasi||'', i.pesertaBaik||'', i.pesertaBina||'', i.catatanTeknis||'', i.kendala||'', i.tindakLanjut||'', i.syncedAt||new Date().toISOString(), i.createdBy && i.createdBy.userId || '', i.createdBy && i.createdBy.name || '', i.createdBy && i.createdBy.role || '', i.createdBy && i.createdBy.estate || '', i.createdBy && i.createdBy.divisi || '', i.createdBy && i.createdBy.nip || '', i.createdBy && i.createdBy.deviceId || '' ]; }

function recalcRecaps_(ss){
  var reports = readReports_(ss.getSheetByName('LaporanHarian'));
  writeRekapAsisten_(ss.getSheetByName('RekapAsisten'), reports);
  writeRekapManager_(ss.getSheetByName('RekapManager'), reports);
  writeRekapTcHead_(ss.getSheetByName('RekapTCHead'), reports);
  writeRekapBulanan_(ss.getSheetByName('RekapBulanan'), reports);
}

function writeRekapAsisten_(sh, reports){
  clearData_(sh);
  var map = {};
  reports.forEach(function(r){
    var key = [r.tanggal,r.estate,r.divisi].join('|');
    if (!map[key]) map[key] = initAgg_(r.tanggal, r.estate, r.divisi);
    addAgg_(map[key], r);
  });
  var rows = Object.keys(map).sort().map(function(k){ var a=map[k]; return [a.tanggal,a.estate,a.divisi,a.jumlahLaporan,a.hadir,a.tidakHadir,a.mentorAktif,a.materi.join(', '),a.lokasi.join(', '),a.kendala.join('; '),a.tindakLanjut.join('; ')]; });
  if (rows.length) sh.getRange(2,1,rows.length,rows[0].length).setValues(rows);
}
function writeRekapManager_(sh, reports){
  clearData_(sh);
  var map = {};
  reports.forEach(function(r){
    var key = [r.tanggal,r.estate].join('|');
    if (!map[key]) map[key] = initAgg_(r.tanggal, r.estate, '');
    addAgg_(map[key], r);
  });
  var rows = Object.keys(map).sort().map(function(k){ var a=map[k]; return [a.tanggal,a.estate,a.jumlahLaporan,a.hadir,a.tidakHadir,a.mentorAktif,a.divisiList.join(', '),a.materi.join(', '),a.kendala.join('; '),a.tindakLanjut.join('; ')]; });
  if (rows.length) sh.getRange(2,1,rows.length,rows[0].length).setValues(rows);
}
function writeRekapTcHead_(sh, reports){
  clearData_(sh);
  var map = {};
  reports.forEach(function(r){
    var key = r.tanggal;
    if (!map[key]) map[key] = initAgg_(r.tanggal, '', '');
    addAgg_(map[key], r);
  });
  var rows = Object.keys(map).sort().map(function(k){ var a=map[k]; return [a.tanggal,a.jumlahLaporan,a.estateList.join(', '),a.divisiList.join(', '),a.hadir,a.tidakHadir,a.mentorAktif,a.materi.join(', '),a.kendala.join('; '),a.tindakLanjut.join('; ')]; });
  if (rows.length) sh.getRange(2,1,rows.length,rows[0].length).setValues(rows);
}
function initAgg_(tanggal, estate, divisi){ return { tanggal:tanggal, estate:estate, divisi:divisi, jumlahLaporan:0, hadir:0, tidakHadir:0, mentorAktif:0, materi:[], lokasi:[], kendala:[], tindakLanjut:[], estateList:[], divisiList:[] }; }
function addAgg_(a, r){ a.jumlahLaporan++; a.hadir += Number(r.hadirCount||0); a.tidakHadir += Number(r.tidakHadirCount||0); a.mentorAktif += Number(r.mentorAktif||0); pushUniq_(a.materi, splitList_(r.materi)); pushUniq_(a.lokasi, splitList_(r.lokasi)); pushUniq_(a.kendala, splitList_(r.kendala)); pushUniq_(a.tindakLanjut, splitList_(r.tindakLanjut)); pushUniq_(a.estateList, [r.estate]); pushUniq_(a.divisiList, [r.divisiCode]); }
function splitList_(s){ return String(s||'').split(/[;,\n]+/).map(function(x){ return x.trim(); }).filter(Boolean); }
function pushUniq_(arr, vals){ vals.forEach(function(v){ if (arr.indexOf(v) === -1) arr.push(v); }); }
function clearData_(sh){ if (sh.getLastRow() > 1) sh.getRange(2,1,sh.getLastRow()-1,sh.getLastColumn()).clearContent(); }
function appendAudit_(sh, action, message, ts){ sh.appendRow([ts || new Date().toISOString(), action, message]); }

function canSeeMaster_(item, profile){
  var role = String(profile.role || '').toUpperCase();
  var estate = String(profile.estate || '').toUpperCase();
  var divisi = String(profile.divisi || '');
  if (role === 'TC_HEAD') return true;
  if (role === 'MANAGER') return String(item.estate || item.code || '').toUpperCase() === estate;
  return String(item.estate || item.code || '').toUpperCase() === estate && String(item.divisi || '').trim() === divisi;
}
function canSeeUser_(item, profile){
  var role = String(profile.role || '').toUpperCase();
  var estate = String(profile.estate || '').toUpperCase();
  if (role === 'TC_HEAD') return true;
  return String(item.estate || '').toUpperCase() === estate || String(item.role || '').toUpperCase() === 'TC_HEAD';
}
function canSeeReport_(item, profile){
  var role = String(profile.role || '').toUpperCase();
  var estate = String(profile.estate || '').toUpperCase();
  var divisi = String(profile.divisi || '');
  var userId = String(profile.id || '');
  if (role === 'TC_HEAD') return true;
  if (role === 'MANAGER') return String(item.estate || '').toUpperCase() === estate;
  if (role === 'ASISTEN') return String(item.estate || '').toUpperCase() === estate && String(item.divisi || '') === divisi;
  return String(item.createdBy && item.createdBy.userId || '') === userId;
}

function toIsoDate_(v){ if (!v) return ''; if (Object.prototype.toString.call(v) === '[object Date]') return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd'); return String(v).trim(); }
function toBool_(v){ return String(v).toUpperCase() === 'TRUE' || v === true; }
function boolToText_(v){ return v ? 'TRUE' : 'FALSE'; }

function respond_(success, message, extra, req){
  var obj = { success: !!success, message: message || '' };
  if (extra && typeof extra === 'object') Object.keys(extra).forEach(function(k){ obj[k] = extra[k]; });
  if (req && req.callback) return ContentService.createTextOutput(req.callback + '(' + JSON.stringify(obj) + ')').setMimeType(ContentService.MimeType.JAVASCRIPT);
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}


function writeRekapBulanan_(sh, reports){
  clearData_(sh);
  var map = {};
  reports.forEach(function(r){
    var bulan = String(r.tanggal || '').slice(0,7);
    var key = [bulan,r.estate,r.divisi].join('|');
    if (!map[key]) map[key] = { bulan:bulan, estate:r.estate, divisi:r.divisi, divisiCode:r.divisiCode, jumlahLaporan:0, hadir:0, tidakHadir:0, mentorAktif:0, mandor:[] };
    map[key].jumlahLaporan++;
    map[key].hadir += Number(r.hadirCount||0);
    map[key].tidakHadir += Number(r.tidakHadirCount||0);
    map[key].mentorAktif += Number(r.mentorAktif||0);
    pushUniq_(map[key].mandor, [r.mandorName]);
  });
  var rows = Object.keys(map).sort().map(function(k){ var a=map[k]; return [a.bulan,a.estate,a.divisi,a.divisiCode,a.jumlahLaporan,a.hadir,a.tidakHadir,a.mentorAktif,a.mandor.join(', ')]; });
  if (rows.length) sh.getRange(2,1,rows.length,rows[0].length).setValues(rows);
}
function saveConfig_(sh, settings){
  if (!sh) return;
  var pairs = [
    ['gasUrl', String(settings.gasUrl || '')],
    ['sheetId', String(settings.sheetId || '')],
    ['defaultTheme', String(settings.defaultTheme || 'light')]
  ];
  clearData_(sh);
  sh.getRange(2,1,pairs.length,2).setValues(pairs);
}
function readConfig_(sh){
  var obj = {};
  readRows_(sh).forEach(function(r){ obj[String(r[0] || '')] = String(r[1] || ''); });
  return obj;
}
