/** Sekolah Pemanen - GAS Backend (Web App)
 * Deploy as Web App (doGet) and call via ?action=...
 *
 * IMPORTANT:
 * 1) Isi SPREADSHEET_ID
 * 2) Pastikan sheet names sesuai template di /data/templates
 */

const CONFIG = {
  SPREADSHEET_ID: '1VbKX62jB_hpcwzpO3rTs6euo0vdDea84lK2zWVbAtNY',

  // session ttl (jam)
  SESSION_TTL_HOURS: 24,

  CERT_FOLDER_ID: '1jb1uAZpMU2D25nMDahcnEv-kFqPwdgMR',
  LOGO_FOLDER_ID: '1sEtLR85W_3fdiyfU8tof0Z6ANUQwgUyU',
  DOCS_FOLDER_ID: '18JEB6EqjW8jBzHYVDSo67wAY-F8aPvhX',
  CANDIDATE_DOCS_FOLDER_ID: '18JEB6EqjW8jBzHYVDSo67wAY-F8aPvhX',

  SHEETS: {
    Settings: 'Settings',
    Users: 'Users',

    // ✅ WAJIB ditambah (dipakai saat login & audit)
    Sessions: 'Sessions',
    AuditLogs: 'AuditLogs',
    MasterEstates: 'MasterEstates',

    Programs: 'Programs',
    Candidates: 'Candidates',
    SelectionResults: 'SelectionResults',
    Participants: 'Participants',
    Mentors: 'Mentors',
    Pairings: 'Pairings',
    DailyLogs: 'DailyLogs',
    WeeklyRecaps: 'WeeklyRecaps',
    Graduations: 'Graduations',
    Certificates: 'Certificates',
    MentorIncentives: 'MentorIncentives'
  }
};

// -------------------- Entry --------------------
function doGet(e) {
  const p = (e && e.parameter) ? e.parameter : {};
  const action = (p.action || '').trim();

  try {
    if (!action) {
      // Jika dibuka langsung via browser tanpa action, tampilkan halaman info sederhana (agar tidak terlihat sebagai error di UI).
      if (p && p.format === 'html') {
        return HtmlService.createHtmlOutput(
          '<html><body style="font-family:system-ui;padding:16px">' +
          '<h2>Sekolah Pemanen API</h2><p>Gunakan parameter <code>?action=...</code>.</p>' +
          '<p>Contoh: <code>?action=ping</code></p>' +
          '</body></html>'
        );
      }
      return respond_(p, { ok: false, error: 'Missing action' });
    }

    if (action === 'ping') return respond_(p, { ok: true, ts: nowIso_() });
    // Sertifikat verification (JSON / HTML)
    if (action === 'verifyCert') {
      const out = verifyCert_(p);
      if (String(p.format||'') === 'html') return HtmlService.createHtmlOutput(out.html||'');
      return respond_(p, out.json||out);
    }

    if (action === 'login') return respond_(p, login_(p));
    if (action === 'me') return respond_(p, me_(p));

    // Auth required
    const sess = requireSession_(p.token);

    switch (action) {
      case 'dashboard': return respond_(p, dashboard_(sess, p));
      case 'listPrograms': return respond_(p, listPrograms_(sess));
      case 'createProgram': return respond_(p, createProgram_(sess, p));
      case 'setActiveProgram': return respond_(p, setActiveProgram_(sess, p));
      case 'closeProgram': return respond_(p, closeProgram_(sess, p));
      case 'dashboardAllPrograms': return respond_(p, dashboardAllPrograms_(sess, p));

      case 'listCandidates': return respond_(p, listCandidates_(sess, p));
      case 'upsertCandidate': return respond_(p, upsertCandidate_(sess, p));
      case 'verifyCandidate': return respond_(p, verifyCandidate_(sess, p));

      case 'listSelection': return respond_(p, listSelection_(sess, p));
      case 'submitSelection': return respond_(p, submitSelection_(sess, p));

      case 'generateParticipantsFromSelection': return respond_(p, generateParticipantsFromSelection_(sess, p));
      case 'listParticipants': return respond_(p, listParticipants_(sess, p));
      case 'setPlacement': return respond_(p, setPlacement_(sess, p));

      case 'listMentors': return respond_(p, listMentors_(sess, p));
      case 'upsertMentor': return respond_(p, upsertMentor_(sess, p));
      case 'assignMentor': return respond_(p, assignMentor_(sess, p));
      case 'myMentees': return respond_(p, myMentees_(sess, p));

      case 'submitDailyLog': return respond_(p, submitDailyLog_(sess, p));
      case 'getDailyLogs': return respond_(p, getDailyLogs_(sess, p));
      case 'computeWeeklyRecap': return respond_(p, computeWeeklyRecap_(sess, p));

      case 'listGraduation': return respond_(p, listGraduation_(sess, p));
      case 'graduateParticipant': return respond_(p, graduateParticipant_(sess, p));

      case 'issueCertificate': return respond_(p, issueCertificate_(sess, p));
      case 'listCertificates': return respond_(p, listCertificates_(sess, p));

      case 'listMentorIncentives': return respond_(p, listMentorIncentives_(sess, p));
      case 'verifyIncentive': return respond_(p, verifyIncentive_(sess, p));

      case 'checkDriveAccess': return respond_(p, checkDriveAccess_(sess, p));

      case 'listMasterEstates': return respond_(p, listMasterEstates_(sess));
      case 'upsertMasterEstate': return respond_(p, upsertMasterEstateAction_(sess, p));
      case 'deleteMasterEstate': return respond_(p, deleteMasterEstate_(sess, p));

      case 'getSettings': return respond_(p, getSettings_(sess, p));
      case 'setSettings': return respond_(p, setSettings_(sess, p));
      case 'listUsers': return respond_(p, listUsers_(sess));
      case 'upsertUser': return respond_(p, upsertUser_(sess, p));
      case 'deleteUser': return respond_(p, deleteUser_(sess, p));
      case 'resetUserPin': return respond_(p, resetUserPin_(sess, p));
      case 'changeMyPin': return respond_(p, changeMyPin_(sess, p));
      case 'dashboardDetail': return respond_(p, dashboardDetail_(sess, p));
      case 'regenerateCertificatePdf': return respond_(p, regenerateCertificatePdf_(sess, p));

      case 'lookupParticipants': return respond_(p, lookupParticipants_(sess, p));
      case 'lookupMentors': return respond_(p, lookupMentors_(sess, p));
      case 'getParticipantMentor': return respond_(p, getParticipantMentor_(sess, p));


      default:
        return respond_(p, { ok: false, error: 'Unknown action: ' + action });
    }
  } catch (err) {
    return respond_(p, { ok: false, error: String(err && err.message ? err.message : err) });
  }
}



// -------------------- Entry (POST) --------------------
function doPost(e) {
  const p = (e && e.parameter) ? e.parameter : {};

  try {
    // Parse body (JSON or x-www-form-urlencoded)
    let body = {};
    const raw = (e && e.postData && e.postData.contents) ? String(e.postData.contents) : '';

    if (raw) {
      // 1) coba JSON dulu (upload via fetch text/plain)
      try {
        body = JSON.parse(raw);
      } catch (err) {
        // 2) fallback parse form-urlencoded
        try {
          raw.split('&').forEach(kv => {
            const i = kv.indexOf('=');
            const k = i >= 0 ? kv.slice(0, i) : kv;
            const v = i >= 0 ? kv.slice(i + 1) : '';
            if (!k) return;
            body[decodeURIComponent(k)] = decodeURIComponent(v || '');
          });
        } catch (e2) {}
      }
    }

    // ✅ gabungkan query params + body
    const merged = Object.assign({}, p, body);

    // ✅ action harus diambil dari merged (bukan p saja)
    const action = String(merged.action || '').trim();
    if (!action) {
      return ContentService
        .createTextOutput(JSON.stringify({ ok:false, error:'Missing action' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // ---- Lanjutkan logika Anda yang existing di bawah ini ----
    if (action === 'uploadLogo') {
      const sess = requireSession_(merged.token);
      const out = uploadLogo_(sess, merged);
      if (String(merged.format || '') === 'html') {
        const payload = JSON.stringify(out);
        const html = '<!doctype html><html><body>'+
          '<script>'+
          'try{ var t = window.opener || window.parent; if(t){ t.postMessage({type:"uploadLogoResult", payload: '+payload+'}, "*"); } }catch(e){}' +
          'try{ setTimeout(function(){ window.close(); }, 150); }catch(e){}' +
          '</script>'+
          '</body></html>';
        return HtmlService.createHtmlOutput(html);
      }
      return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'uploadCandidateDoc') {
      const sess = requireSession_(merged.token);
      const out = uploadCandidateDoc_(sess, merged);
      if (String(merged.format || '') === 'html') {
        const payload = JSON.stringify(out);
        const html = '<!doctype html><html><body>' +
          '<script>' +
          'try{ var t = window.opener || window.parent; if(t){ t.postMessage({type:"uploadCandidateDocResult", payload: ' + payload + '}, "*"); } }catch(e){}' +
          'try{ setTimeout(function(){ window.close(); }, 150); }catch(e){}' +
          '</script>' +
          '</body></html>';
        return HtmlService.createHtmlOutput(html);
      }
      return ContentService
        .createTextOutput(JSON.stringify(out))
        .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ ok:false, error:'Unknown POST action: ' + action }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok:false, error:String(err && err.message ? err.message : err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// -------------------- Auth --------------------
function login_(p) {
  const nik = (p.nik || '').trim();
  const pin = (p.pin || '').trim();
  if (!nik || !pin) return { ok: false, error: 'NIK/PIN wajib' };

  const users = sheetToObjects_('Users');
  const u = users.find(x => String(x.nik||'') === nik && String(x.active||'TRUE').toUpperCase() === 'TRUE');
  if (!u) return { ok: false, error: 'User tidak ditemukan / nonaktif' };
  if (String(u.pin||'') !== pin) return { ok: false, error: 'PIN salah' };

  const token = Utilities.getUuid();
  const expires = new Date(Date.now() + CONFIG.SESSION_TTL_HOURS * 3600 * 1000);
  appendRow_('Sessions', {
    token,
    role: u.role || 'ADMIN',
    nik_or_user: nik,
    expires_at: toIso_(expires),
    created: nowIso_()
  });

  audit_(nik, 'LOGIN', 'Users', u.user_id || '', { role: u.role });

  return {
    ok: true,
    token,
    user: {
      nik: nik,
      name: u.name || nik,
      role: u.role || 'ADMIN',
      estate: (u.estate || '').trim(),
      divisi: String(u.divisi || '').trim()
    }
  };
}

function me_(p) {
  const sess = requireSession_(p.token);
  return { ok: true, user: sess.user };
}

function requireSession_(token) {
  token = String(token || '').trim();
  if (!token) throw new Error('Token kosong (login dulu)');
  const sessRows = sheetToObjects_('Sessions');
  const s = sessRows.find(x => String(x.token||'') === token);
  if (!s) throw new Error('Session tidak valid');
  const exp = new Date(String(s.expires_at||''));
  if (isNaN(exp.getTime()) || exp.getTime() < Date.now()) throw new Error('Session expired');

  const users = sheetToObjects_('Users');
  const u = users.find(x => String(x.nik||'') === String(s.nik_or_user||''));

  const user = {
    nik: s.nik_or_user,
    name: (u && u.name) ? u.name : s.nik_or_user,
    role: (u && u.role) ? u.role : (s.role||''),
    estate: (u && u.estate) ? String(u.estate).trim().toUpperCase() : '',
    divisi: (u && (u.divisi !== undefined)) ? String(u.divisi).trim() : ''
  };

  return { token, user };
}

// -------------------- Dashboard / Program --------------------

/**
 * Dashboard ringkas.
 * Default: pakai activeProgramId (Settings).
 * Jika frontend mengirim ?program_id=..., maka dashboard dihitung untuk program tsb (termasuk CLOSED).
 */
function dashboard_(sess, p) {
  const ctx = resolveProgramContext_(sess, p, true);
  const programId = ctx.program_id;
  ensureColumns_('Candidates', ['program_id','estate','divisi']);
  ensureColumns_('Mentors', ['program_id','estate','divisi','updated_at']);
  const candidatesAll = sheetToObjects_('Candidates');
  const candidates = candidatesAll.filter(x => !programId || String(x.program_id||'') === programId);
  const participantsAll = sheetToObjects_('Participants');
  let participants = participantsAll.filter(x => !programId || String(x.program_id||'') === programId);
  let mentors = sheetToObjects_('Mentors').filter(x => !programId || String(x.program_id||'') === programId);

  if (!isAdmin_(sess)) {
    participants = participants.filter(p => scopeMatchesEstateDivisi_(sess, p.estate, p.divisi));
    mentors = mentors.filter(m => scopeMatchesEstateDivisi_(sess, m.estate, m.divisi));
  }

  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const logsTodayAll = sheetToObjects_('DailyLogs')
    .filter(x => String(x.date||'') === today)
    .filter(x => !programId || String(x.program_id||'') === programId);

  const visibleIds = new Set(participants.map(p => String(p.participant_id||'')));
  const logsToday = isAdmin_(sess) ? logsTodayAll : logsTodayAll.filter(l => visibleIds.has(String(l.participant_id||'')));
  const loggedIds = new Set(logsToday.map(x => String(x.participant_id||'')));
  const alertsCount = participants.filter(p => !loggedIds.has(String(p.participant_id||''))).length;

  const byCat = {};
  participants.forEach(p => {
    const c = String(p.category||'').trim() || 'NA';
    byCat[c] = (byCat[c]||0) + 1;
  });

  const tz = Session.getScriptTimeZone();
  const days = [];
  const counts = [];
  const allLogsAll = sheetToObjects_('DailyLogs').filter(x => !programId || String(x.program_id||'') === programId);
  const allLogs = isAdmin_(sess) ? allLogsAll : allLogsAll.filter(l => visibleIds.has(String(l.participant_id||'')));

  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i*24*3600*1000);
    const key = Utilities.formatDate(d, tz, 'yyyy-MM-dd');
    days.push(key);
    counts.push(allLogs.filter(x => String(x.date||'') === key).length);
  }

  return {
    ok: true,
    activeProgramId: programId,
    stats: {
      candidates: isAdmin_(sess) ? candidates.length : 0,
      participants: participants.length,
      mentors: mentors.length,
      alerts: alertsCount
    },
    chartData: {
      participantsByCategory: byCat,
      dailyLogsLast7Days: { labels: days, values: counts }
    }
  };
}


function listPrograms_(sess){
  const progs = sheetToObjects_('Programs');
  const myEstate = getEstateCodeFromSession_(sess);
  const myActiveId = getActiveProgramIdForEstate_(myEstate);
  const myActive = myActiveId ? (progs.find(x => String(x.program_id||'') === myActiveId) || null) : null;

  // Build mapping active program per estate (based on MasterEstates)
  const estates = sheetToObjects_('MasterEstates').filter(x => String(x.active||'TRUE').toUpperCase()==='TRUE');
  const activeByEstate = {};
  estates.forEach(e=>{
    const code = String(e.estate_code||'').trim().toUpperCase();
    if (!code) return;
    const pid = getActiveProgramIdForEstate_(code);
    if (pid) activeByEstate[code] = pid;
  });

  // History = program CLOSED (untuk UI)
  const historyPrograms = progs.filter(p => String(p.status||'').toUpperCase()==='CLOSED');

  return {
    ok: true,
    programs: progs,
    activeProgram: myActive,
    myEstate,
    myActiveProgramId: myActiveId || '',
    activeProgramsByEstate: activeByEstate,
    legacyGlobalActiveProgramId: getSetting_('activeProgramId') || '',
    historyPrograms,
    estates: estates.map(e=>({ estate_code:String(e.estate_code||'').trim().toUpperCase(), estate_name:e.estate_name||'', manager_name:e.manager_name||'' }))
  };
}


function createProgram_(sess, p) {
  if (sess.user.role !== 'ADMIN') return { ok: false, error: 'Hanya ADMIN' };
  const program_id = Utilities.getUuid();
  const row = {
    program_id,
    name: (p.name||'').trim(),
    period_start: (p.period_start||'').trim(),
    period_end: (p.period_end||'').trim(),
    location: (p.location||'').trim(),
    quota: (p.quota||'').trim(),
    status: 'DRAFT',
    created_by: sess.user.nik,
    created_at: nowIso_()
  };
  if (!row.name) return { ok:false, error:'Nama program wajib' };
  appendRow_('Programs', row);
  audit_(sess.user.nik, 'CREATE', 'Programs', program_id, row);
  return { ok:true, program_id };
}


function setActiveProgram_(sess, p) {
  if (!isAdmin_(sess)) return { ok: false, error: 'Hanya ADMIN' };

  const program_id = String(p.program_id || '').trim();
  if (!program_id) return { ok:false, error:'program_id kosong' };

  const estate = resolveEstateCode_(sess, p);
  if (!estate) return { ok:false, error:'estate_code kosong. Pastikan user memiliki Estate atau kirim parameter estate_code (ADMIN).' };

  // Simpan mapping active program per-estate
  setSetting_('activeProgramId:' + estate, program_id);

  // Set status program jadi ACTIVE (global), agar terlihat jelas di list/dashboard.
  try {
    updateById_('Programs', 'program_id', program_id, { status: 'ACTIVE' });
  } catch (e) {}

  return { ok:true, estate_code: estate, activeProgramId: program_id };
}

/**
 * Close program (set status = CLOSED) and move it to History list.
 * Also clears activeProgramId:<ESTATE> mappings that currently point to this program.
 */
function closeProgram_(sess, p) {
  if (!isAdmin_(sess)) return { ok: false, error: 'Hanya ADMIN' };

  const program_id = String(p.program_id || '').trim();
  if (!program_id) return { ok:false, error:'program_id kosong' };

  const prog = findById_('Programs', 'program_id', program_id);
  if (!prog) return { ok:false, error:'Program tidak ditemukan' };

  const status = String(prog.status || '').toUpperCase();
  if (status === 'CLOSED') return { ok:true, program_id, status:'CLOSED' };

  const now = nowIso_();
  // Update program status
  writeRowById_('Programs', 'program_id', program_id, { status: 'CLOSED', closed_at: now }, true);

  // Clear active mapping for estates that reference this program
  try {
    const estates = sheetToObjects_('MasterEstates').filter(x => String(x.active||'TRUE').toUpperCase()==='TRUE');
    estates.forEach(e => {
      const code = String(e.estate_code||'').trim().toUpperCase();
      if (!code) return;
      const key = 'activeProgramId:' + code;
      const pid = getSetting_(key) || '';
      if (String(pid) === program_id) setSetting_(key, '');
    });
    // legacy global
    const legacy = getSetting_('activeProgramId') || '';
    if (String(legacy) === program_id) setSetting_('activeProgramId', '');
  } catch (e) {}

  audit_(sess.user.nik, 'PROGRAM_CLOSE', 'Programs', program_id, { program_id, ts: now });
  return { ok:true, program_id, status:'CLOSED', closed_at: now };
}

/**
 * Admin dashboard: show summary for ALL programs + active mapping per estate.
 */
function dashboardAllPrograms_(sess, p) {
  if (!isAdmin_(sess)) return { ok:false, error:'Hanya ADMIN' };

  const progs = sheetToObjects_('Programs');
  const participants = sheetToObjects_('Participants');
  const dailyLogs = sheetToObjects_('DailyLogs');

  const tz = Session.getScriptTimeZone();
  const today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');

  const estates = sheetToObjects_('MasterEstates').filter(x => String(x.active||'TRUE').toUpperCase()==='TRUE');
  const activeByEstate = {};
  estates.forEach(e=>{
    const code = String(e.estate_code||'').trim().toUpperCase();
    if (!code) return;
    const pid = getActiveProgramIdForEstate_(code);
    activeByEstate[code] = pid || '';
  });

  // Build program stats
  const statsByProgram = {};
  progs.forEach(pr => {
    const pid = String(pr.program_id||'');
    if (!pid) return;
    statsByProgram[pid] = {
      program_id: pid,
      name: pr.name || '',
      status: String(pr.status||'').toUpperCase() || 'DRAFT',
      period_start: pr.period_start || '',
      period_end: pr.period_end || '',
      location: pr.location || '',
      quota: pr.quota || '',
      created_at: pr.created_at || '',
      closed_at: pr.closed_at || '',
      participants_total: 0,
      participants_by_estate: {},
      logs_today_total: 0,
      logs_today_by_estate: {}
    };
  });

  participants.forEach(pt => {
    const pid = String(pt.program_id||'');
    if (!pid || !statsByProgram[pid]) return;
    const est = String(pt.estate||'').trim().toUpperCase() || '(NA)';
    statsByProgram[pid].participants_total++;
    statsByProgram[pid].participants_by_estate[est] = (statsByProgram[pid].participants_by_estate[est]||0)+1;
  });

  dailyLogs.forEach(lg => {
    if (String(lg.date||'') !== today) return;
    const pid = String(lg.program_id||'');
    if (!pid || !statsByProgram[pid]) return;
    // infer estate from participant
    let est = '';
    try {
      const pt = participants.find(x => String(x.participant_id||'') === String(lg.participant_id||''));
      est = String((pt && pt.estate) || '').trim().toUpperCase();
    } catch(e) {}
    est = est || '(NA)';
    statsByProgram[pid].logs_today_total++;
    statsByProgram[pid].logs_today_by_estate[est] = (statsByProgram[pid].logs_today_by_estate[est]||0)+1;
  });

  // Active estate table
  const estateRows = estates.map(e=>{
    const code = String(e.estate_code||'').trim().toUpperCase();
    const pid = activeByEstate[code] || '';
    const pr = pid ? (progs.find(x=>String(x.program_id||'')===pid) || {}) : {};
    return {
      estate_code: code,
      estate_name: e.estate_name || '',
      manager_name: e.manager_name || '',
      active_program_id: pid,
      active_program_name: pr.name || '',
      active_program_status: String(pr.status||'').toUpperCase() || (pid ? 'NA' : '')
    };
  });

  return {
    ok:true,
    today,
    activeProgramsByEstate: activeByEstate,
    estates: estateRows,
    programs: Object.values(statsByProgram).sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')))
  };
}



function listCandidates_(sess, p) {
  const ctx = resolveProgramContext_(sess, p || {}, true);
  const programId = ctx.program_id;

  // Ensure columns (sesuai sheet Candidates terbaru)
  ensureColumns_('Candidates', [
    'candidate_id','nik','name','gender','dob','phone','address','education','source','applied_at',
    'admin_status','admin_notes','docs_ktp','docs_kk','docs_skck','docs_health','photo_url','verified_by','verified_at',
    'program_id','estate','divisi','family_id','relation','updated_at'
  ]);

  let candidates = sheetToObjects_('Candidates')
    .filter(x => !programId || String(x.program_id||'') === String(programId));

  if (!isAdmin_(sess)) {
    candidates = candidates.filter(c => scopeMatchesEstateDivisi_(sess, c.estate, c.divisi));
  }
  return { ok:true, candidates };
}

function upsertCandidate_(sess, p) {
  if (!inRoles_(sess, ['ADMIN'])) return { ok:false, error:'Hanya ADMIN' };
  const ctx = resolveProgramContext_(sess, p || {}, true);
  const programId = ctx.program_id;

  ensureColumns_('Candidates', [
    'candidate_id','nik','name','gender','dob','phone','address','education','source','applied_at',
    'admin_status','admin_notes','docs_ktp','docs_kk','docs_skck','docs_health','photo_url','verified_by','verified_at',
    'program_id','estate','divisi','family_id','relation','updated_at'
  ]);
  const sheetName = 'Candidates';
  const headers = getHeaders_(sheetName);
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sh = ss.getSheetByName(CONFIG.SHEETS[sheetName]);
  const values = sh.getDataRange().getValues();
  const idx = headers.indexOf('candidate_id');

  const candId = (p.candidate_id||'').trim();
  // ===========================
  // AUTO FAMILY ID (PAIRING)
  // ===========================
  const rel = String(p.relation || 'INDIVIDU').trim().toUpperCase();
  const needsPartner = ['SUAMI','ISTRI','SAUDARA','TANDEM'].indexOf(rel) >= 0;

  // family_id yang akan dipakai untuk row yang sedang disimpan
  let familyId = String(p.family_id || '').trim();

  if (needsPartner) {
    const partnerId = String(p.partner_candidate_id || '').trim();
    if (!partnerId) return { ok:false, error:'Relation ' + rel + ' wajib pilih pasangan' };

    // pasangan wajib ada & satu program
    const idIdx = headers.indexOf('candidate_id');
    const partnerRowNo = findRowIndexById_(values, idIdx, partnerId);
    if (partnerRowNo < 2) return { ok:false, error:'Pasangan tidak ditemukan' };

    const partner = rowToObject_(headers, values[partnerRowNo-1]);
    if (String(partner.program_id||'').trim() !== String(programId||'').trim()) {
      return { ok:false, error:'Pasangan harus dalam program yang sama' };
    }

    const partnerFam = String(partner.family_id || '').trim();

    // Prioritas: pakai family_id pasangan jika ada
    if (partnerFam) familyId = partnerFam;

    // jika keduanya belum punya family_id → buat baru
    if (!familyId) familyId = ('FAM-' + Utilities.getUuid().slice(0,8)).toUpperCase();

    // Pastikan pasangan juga ikut diset family_id yang sama
    if (partnerFam !== familyId) {
      writeRowById_(
        'Candidates',
        'candidate_id',
        partnerId,
        { family_id: familyId, updated_at: nowIso_() },
        true
      );
    }
  } else {
    // INDIVIDU: jika user memang ingin "lepas pasangan", frontend kirim __clear_family=1
    if (rel === 'INDIVIDU' && String(p.__clear_family||'') === '1') {
      familyId = '';
    }
  }

  // normalize balik ke payload p untuk dipakai di rowObj
  p.relation = rel;
  p.family_id = familyId;
  const rowObj = {
    candidate_id: candId || Utilities.getUuid(),
    program_id: String(programId||'').trim(),
    estate: (p.estate||'').trim(),
    divisi: (p.divisi||'').trim(),
    family_id: (p.family_id||'').trim(),
    relation: (p.relation||'').trim(),
    nik: (p.nik||'').trim(),
    name: (p.name||'').trim(),
    gender: (p.gender||'').trim(),
    dob: (p.dob||'').trim(),
    phone: (p.phone||'').trim(),
    address: (p.address||'').trim(),
    education: (p.education||'').trim(),
    source: (p.source||'').trim(),
    applied_at: String(p.applied_at||'').trim() || nowIso_(),
    // jika create: default SUBMITTED, tapi tetap terima bila payload mengirim
    admin_status: String(p.admin_status||'').trim() || (candId ? undefined : 'SUBMITTED'),
    admin_notes: candId ? (String(p.admin_notes||'').trim() || undefined) : (String(p.admin_notes||'').trim() || ''),
    docs_ktp: String(p.docs_ktp||'').trim() || undefined,
    docs_kk: String(p.docs_kk||'').trim() || undefined,
    docs_skck: String(p.docs_skck||'').trim() || undefined,
    docs_health: String(p.docs_health||'').trim() || undefined,
    photo_url: String(p.photo_url||'').trim() || undefined,
    updated_at: nowIso_()
  };

  if (!rowObj.nik || !rowObj.name) return { ok:false, error:'NIK & Nama wajib' };

  // Validasi duplikat NIK (Candidates)
  const all = sheetToObjects_('Candidates');
  const dup = all.find(x => String(x.nik||'').trim()===rowObj.nik && String(x.program_id||'')===String(rowObj.program_id||'') && String(x.candidate_id||'')!==rowObj.candidate_id);
  if (dup) return { ok:false, error:'NIK sudah terdaftar pada calon lain.' };

  if (!candId) {
    appendRow_(sheetName, rowObj);
    audit_(sess.user.nik, 'CREATE', 'Candidates', rowObj.candidate_id, rowObj);
    return { ok:true, candidate_id: rowObj.candidate_id };
  }

  // update
  const rowIndex = findRowIndexById_(values, idx, candId);
  if (rowIndex < 2) return { ok:false, error:'Candidate not found' };

  const existing = rowToObject_(headers, values[rowIndex-1]);
  const updated = Object.assign({}, existing, rowObj);
  // ensure applied_at not overwritten
  updated.applied_at = existing.applied_at || updated.applied_at;
  // preserve admin_status/admin_notes when not provided
  if (rowObj.admin_status === undefined) updated.admin_status = existing.admin_status;
  if (rowObj.admin_notes === undefined) updated.admin_notes = existing.admin_notes;
    // ✅ preserve dokumen ketika tidak dikirim dari form (agar tidak overwrite jadi kosong)
  if (rowObj.docs_ktp === undefined) updated.docs_ktp = existing.docs_ktp;
  if (rowObj.docs_kk === undefined) updated.docs_kk = existing.docs_kk;
  if (rowObj.docs_skck === undefined) updated.docs_skck = existing.docs_skck;
  if (rowObj.docs_health === undefined) updated.docs_health = existing.docs_health;
  if (rowObj.photo_url === undefined) updated.photo_url = existing.photo_url;


  writeRowById_(sheetName, 'candidate_id', candId, updated);
  audit_(sess.user.nik, 'UPDATE', 'Candidates', candId, { nik: updated.nik, name: updated.name });
  return { ok:true, candidate_id: candId };
}

function verifyCandidate_(sess, p) {
  if (!inRoles_(sess, ['ADMIN'])) return { ok:false, error:'Hanya ADMIN' };
  const candidate_id = (p.candidate_id||'').trim();
  if (!candidate_id) return { ok:false, error:'candidate_id kosong' };
  const admin_status = (p.admin_status||'').trim();
  const admin_notes = (p.admin_notes||'').trim();

  const upd = {
    admin_status,
    admin_notes,
    verified_by: sess.user.nik,
    verified_at: nowIso_(),
    updated_at: nowIso_()
  };
  writeRowById_('Candidates', 'candidate_id', candidate_id, upd, true);
  audit_(sess.user.nik, 'VERIFY', 'Candidates', candidate_id, upd);
  return { ok:true };
}

// -------------------- Selection --------------------
function listSelection_(sess, p) {
  const ctx = resolveProgramContext_(sess, p || {}, true);
  const activeProgramId = ctx.program_id;
  if (!activeProgramId) return { ok:false, error:'activeProgramId belum diset (menu Program)' };

  ensureColumns_('Candidates', ['program_id','estate','divisi']);
  ensureColumns_('Mentors', ['program_id','estate','divisi','updated_at']);

  const candidatesAll = sheetToObjects_('Candidates');
  const candidates = candidatesAll.filter(x => String(x.program_id||'') === String(activeProgramId));

  const sel = sheetToObjects_('SelectionResults').filter(x => String(x.program_id||'') === String(activeProgramId));

  // latest selection per candidate_id
  const latestByCandidate = {};
  sel.forEach(s => {
    const cid = String(s.candidate_id||'');
    if (!cid) return;
    const ts = String(s.ts||'');
    if (!latestByCandidate[cid] || String(latestByCandidate[cid].ts||'') < ts) latestByCandidate[cid] = s;
  });

  const items = candidates.map(c => {
    const s = latestByCandidate[String(c.candidate_id||'')] || {};
    return {
      candidate_id: c.candidate_id,
      nik: c.nik,
      name: c.name,
      admin_status: c.admin_status,
      tes_fisik_score: s.tes_fisik_score || '',
      tes_panen_score: s.tes_panen_score || '',
      tes_karakter_score: s.tes_karakter_score || '',
      recommend_category: s.recommend_category || '',
      final_category: s.final_category || '',
      notes: s.notes || ''
    };
  });

  // scope filter non-admin (optional, kalau kandidat sudah punya estate/divisi)
  if (!isAdmin_(sess)) {
    return { ok:true, items: items.filter(it => {
      const c = candidatesAll.find(x => String(x.candidate_id||'')===String(it.candidate_id||'')) || {};
      return scopeMatchesEstateDivisi_(sess, c.estate, c.divisi);
    }) };
  }

  return { ok:true, items };
}

function submitSelection_(sess, p) {
  if (!inRoles_(sess, ['ADMIN','ASISTEN','MANDOR'])) return { ok:false, error:'Role tidak diizinkan' };

  const ctx = resolveProgramContext_(sess, p || {}, true);
  const activeProgramId = ctx.program_id;
  if (!activeProgramId) return { ok:false, error:'activeProgramId belum diset' };

  const candidate_id = (p.candidate_id||'').trim();
  if (!candidate_id) return { ok:false, error:'candidate_id kosong' };

  const fisik = num_(p.tes_fisik_score);
  const panen = num_(p.tes_panen_score);
  const karakter = num_(p.tes_karakter_score);

  const tes_fisik_pass = (fisik >= 70);
  const tes_panen_pass = (panen >= 60);
  const tes_karakter_pass = (karakter >= 70);

  let recommend = 'C';
  if (tes_fisik_pass && panen >= 80 && tes_karakter_pass) recommend = 'A';
  else if (tes_fisik_pass && tes_panen_pass) recommend = 'B';

  const finalCat = (p.final_category||'').trim() || recommend;

  const row = {
    selection_id: Utilities.getUuid(),
    program_id: activeProgramId,
    candidate_id,
    ts: nowIso_(),
    tes_fisik_score: String(p.tes_fisik_score||'').trim(),
    tes_fisik_pass: tes_fisik_pass ? 'TRUE' : 'FALSE',
    tes_panen_score: String(p.tes_panen_score||'').trim(),
    tes_panen_pass: tes_panen_pass ? 'TRUE' : 'FALSE',
    tes_karakter_score: String(p.tes_karakter_score||'').trim(),
    tes_karakter_pass: tes_karakter_pass ? 'TRUE' : 'FALSE',
    recommend_category: recommend,
    final_category: finalCat,
    decision: (finalCat === 'C') ? 'REJECTED' : 'APPROVED',
    decided_by: sess.user.nik,
    decided_at: nowIso_(),
    notes: (p.notes||'').trim()
  };

  appendRow_('SelectionResults', row);
  audit_(sess.user.nik, 'SUBMIT', 'SelectionResults', row.selection_id, row);
  return { ok:true, recommend_category: recommend, final_category: finalCat };
}

// -------------------- Participants --------------------
function generateParticipantsFromSelection_(sess, p) {
  if (!inRoles_(sess, ['ADMIN'])) return { ok:false, error:'Hanya ADMIN' };
  const ctx = resolveProgramContext_(sess, p || {}, true);
  const programId = ctx.program_id;
  if (!programId) return { ok:false, error:'activeProgramId belum diset' };

  // Pastikan kolom yang dibutuhkan ada
  ensureColumns_('Candidates', ['program_id','estate','divisi','family_id']);
  ensureColumns_('Participants', [
    'program_id','candidate_id','nik','name','family_id',
    'category','status','start_date','end_date','mentor_id',
    'estate','divisi','ancak','trial_start','trial_end','created_at','updated_at'
  ]);

  // Setting family placement
  // SAME  : family_id sama -> usahakan ancak sama
  // SPLIT : boleh dipisah (tetap coba sama, tapi bisa dipisah bila diperlukan)
  const familyMode = String(getSetting_('familyPlacementMode') || 'SAME').trim().toUpperCase();

  const candidatesAll = sheetToObjects_('Candidates');
  const candidates = candidatesAll.filter(x => String(x.program_id||'') === String(programId));

  const selAll = sheetToObjects_('SelectionResults').filter(x => String(x.program_id||'') === String(programId));

  // latest selection per candidate
  const latestByCandidate = {};
  selAll.forEach(s => {
    const cid = String(s.candidate_id||''); if (!cid) return;
    const tsRaw = String(s.ts||'').trim();
    const t = tsRaw ? new Date(tsRaw).getTime() : 0;

    const prev = latestByCandidate[cid];
    const prevRaw = prev ? String(prev.ts||'').trim() : '';
    const prevT = prevRaw ? new Date(prevRaw).getTime() : 0;

    const pick = (!prev) || (isFinite(t) && t > prevT) || (!isFinite(t) && prevRaw < tsRaw);
    if (pick) latestByCandidate[cid] = s;
  });

  // existing participants in program
  const participants = sheetToObjects_('Participants').filter(x => String(x.program_id||'') === String(programId));
  const existByCandidate = new Set(participants.map(x => String(x.candidate_id||'')));

  // build placement state (untuk auto-ancak) + family placement map
  const placementState = buildPlacementState_(participants);
  const famPlacement = buildFamilyPlacementMap_(participants); // family_id -> {estate,divisi,ancak}

  let created = 0;

  candidates.forEach(c => {
    const cid = String(c.candidate_id||'');
    if (!cid) return;
    if (existByCandidate.has(cid)) return;

    const s = latestByCandidate[cid];
    if (!s) return;

    const decision = String(s.decision||'').trim().toUpperCase();
    const cat = String((s.final_category || s.recommend_category || '')).trim().toUpperCase();

    // jika decision terisi, harus APPROVED
    if (decision && decision !== 'APPROVED') return;
    if (cat !== 'A' && cat !== 'B') return;

    const family_id = String(c.family_id || '').trim();

    // Start date selalu konsisten yyyy-MM-dd (hindari Fri Feb... di sheet)
    const startDate = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');

    // Default row
    const row = {
      participant_id: Utilities.getUuid(),
      program_id: programId,
      candidate_id: cid,
      nik: String(c.nik||'').trim(),
      name: String(c.name||'').trim(),
      family_id: family_id,
      category: cat,
      status: (cat === 'A') ? 'PENEMPATAN' : 'WAIT_PAIRING',  // ✅ A langsung penempatan, B menunggu pairing
      start_date: startDate,
      end_date: '',
      mentor_id: '',
      estate: '',
      divisi: '',
      ancak: '',
      trial_start: '',
      trial_end: '',
      created_at: nowIso_(),
      updated_at: nowIso_()
    };

    // ✅ AUTO PENEMPATAN hanya untuk kategori A
    if (cat === 'A') {
      let estate = String(c.estate || '').trim().toUpperCase();
      let divisi = String(c.divisi || '').trim();

      // fallback: kalau candidate belum punya estate/divisi, pakai scope user (kalau ada)
      if (!estate) estate = String(sess.user.estate || '').trim().toUpperCase();
      if (!divisi) divisi = String(sess.user.divisi || '').trim();

      // family rule: family_id sama -> usahakan ancak sama
      if (family_id && famPlacement[family_id] && familyMode === 'SAME') {
        estate = famPlacement[family_id].estate || estate;
        divisi = famPlacement[family_id].divisi || divisi;
        row.ancak = famPlacement[family_id].ancak || '';
      }

      row.estate = estate;
      row.divisi = divisi;

      // jika belum dapat ancak dari family, auto-assign
      if (!row.ancak && estate && divisi) {
        row.ancak = String(assignNextAncak_(placementState, estate, divisi));
      }

      // simpan mapping family placement untuk peserta berikutnya
      if (family_id && row.estate && row.divisi && row.ancak) {
        if (!famPlacement[family_id]) famPlacement[family_id] = { estate: row.estate, divisi: row.divisi, ancak: row.ancak };
        // mode SPLIT: boleh berbeda, jadi tidak dipaksa overwrite
      }

      // status akhir A setelah ada penempatan
      row.status = 'ORIENTASI';
    }

    appendRow_('Participants', row);
    created++;
    audit_(sess.user.nik, 'CREATE', 'Participants', row.participant_id, {
      nik: row.nik, category: row.category, estate: row.estate, divisi: row.divisi, ancak: row.ancak, family_id: row.family_id
    });
  });

  return { ok:true, created };
}

function listParticipants_(sess, p) {
  const ctx = resolveProgramContext_(sess, p || {}, true);
  const activeProgramId = ctx.program_id;
  if (!activeProgramId) return { ok:false, error:'activeProgramId belum diset' };

  const parts = sheetToObjects_('Participants').filter(x => String(x.program_id||'') === activeProgramId);
  ensureColumns_('Participants', [
    'participant_id','program_id','candidate_id','nik','name','family_id','category','status',
    'start_date','end_date','mentor_id','estate','divisi','ancak',
    'trial_start','trial_end','created_at','updated_at'
  ]);

  ensureColumns_('Mentors', [
    'mentor_id','nik','name','estate','divisi','active','experience_years','notes',
    'created_at','program_id','updated_at'
  ]);

  ensureColumns_('Pairings', [
    'pairing_id','program_id','mentor_id','participant_id','start_date','end_date',
    'status','assigned_by','assigned_at'
  ]);
  const mentors = sheetToObjects_('Mentors').filter(x => !activeProgramId || String(x.program_id||'') === String(activeProgramId));
  const mentorById = {};
  mentors.forEach(m => mentorById[String(m.mentor_id||'')] = m);

  const candById = {};
try {
  ensureColumns_('Candidates', ['candidate_id','name']);
  sheetToObjects_('Candidates').forEach(c => {
    const cid = String(c.candidate_id||'');
    if (!cid) return;
    candById[cid] = c;
  });
} catch (e) {}

  const out = parts.map(p => {
    const nm = String(p.name||'').trim();
    if (!nm) {
      const c = candById[String(p.candidate_id||'')] || {};
      const cn = String(c.name||'').trim();
      if (cn) p.name = cn;
    }
    const m = mentorById[String(p.mentor_id||'')] || {};
    p.mentor_name = m.name || '';
    return p;
  });

  // Role filter (optional)
  if (sess.user.role === 'MENTOR') {
    const my = myMentees_(sess).items || [];
    const ids = new Set(my.map(x => String(x.participant_id||'')));
    return { ok:true, participants: out.filter(p => ids.has(String(p.participant_id||''))) };
  }

  if (!isAdmin_(sess)) {
    return { ok:true, participants: out.filter(p => scopeMatchesEstateDivisi_(sess, p.estate, p.divisi)) };
  }
  return { ok:true, participants: out };
}

function setPlacement_(sess, p) {
  if (!inRoles_(sess, ['ADMIN','ASISTEN'])) return { ok:false, error:'Hanya ADMIN/ASISTEN' };
  const participant_id = (p.participant_id||'').trim();
  if (!participant_id) return { ok:false, error:'participant_id kosong' };

  const upd = {
    estate: (p.estate||'').trim(),
    divisi: (p.divisi||'').trim(),
    ancak: (p.ancak||'').trim(),
    updated_at: nowIso_()
  };
  writeRowById_('Participants', 'participant_id', participant_id, upd, true);
  audit_(sess.user.nik, 'UPDATE', 'Participants', participant_id, upd);
  return { ok:true };
}

// -------------------- Mentors / Pairing --------------------
function listMentors_(sess, p) {
  const ctx = resolveProgramContext_(sess, p || {}, true);
  const activeProgramId = ctx.program_id;
  ensureColumns_('Mentors', [
    'mentor_id','nik','name','estate','divisi','active','experience_years','notes',
    'created_at','program_id','updated_at'
  ]);

  ensureColumns_('Participants', [
    'participant_id','program_id','candidate_id','nik','name','family_id','category','status',
    'start_date','end_date','mentor_id','estate','divisi','ancak',
    'trial_start','trial_end','created_at','updated_at'
  ]);

  ensureColumns_('Pairings', [
    'pairing_id','program_id','mentor_id','participant_id','start_date','end_date',
    'status','assigned_by','assigned_at'
  ]);

  ensureColumns_('Candidates', ['candidate_id','name']);
  const mentors = sheetToObjects_('Mentors').filter(x => !activeProgramId || String(x.program_id||'') === String(activeProgramId));
  const pairings = sheetToObjects_('Pairings').filter(x => !activeProgramId || String(x.program_id||'') === activeProgramId);

  const mentorById = {};
  mentors.forEach(m => mentorById[String(m.mentor_id||'')] = m);

  const parts = sheetToObjects_('Participants').filter(x => !activeProgramId || String(x.program_id||'') === activeProgramId);
  const partById = {};
  parts.forEach(p => partById[String(p.participant_id||'')] = p);
  const candById = {};
  try {
    sheetToObjects_('Candidates').forEach(c => {
      const cid = String(c.candidate_id||'');
      if (cid) candById[cid] = c;
    });
  } catch(e){}

  const pOut = pairings.map(px => {
    const m = mentorById[String(px.mentor_id||'')] || {};
    const pt = partById[String(px.participant_id||'')] || {};
    const ptName = (String(pt.name||'').trim()) || (String((candById[String(pt.candidate_id||'')]||{}).name||'').trim());
    return Object.assign({}, px, {
      mentor_name: m.name || '',
      participant_name: ptName || '',
      participant_nik: pt.nik || ''
    });
  });

  if (!isAdmin_(sess)) {
    if (String(sess.user.role||'') === 'MENTOR') {
      const my = mentors.find(m => String(m.nik||'') === String(sess.user.nik||'')) || null;
      const myId = my ? String(my.mentor_id||'') : '';
      const myMentors = my ? [my] : [];
      const myPairs = myId ? pOut.filter(x => String(x.mentor_id||'') === myId) : [];
      return { ok:true, mentors: myMentors, pairings: myPairs };
    }
    const mFiltered = mentors.filter(m => scopeMatchesEstateDivisi_(sess, m.estate, m.divisi));
    const mIds = new Set(mFiltered.map(m=>String(m.mentor_id||'')));
    const pFiltered = pOut.filter(x => mIds.has(String(x.mentor_id||'')));
    return { ok:true, mentors: mFiltered, pairings: pFiltered };
  }

  return { ok:true, mentors, pairings: pOut };
}

function upsertMentor_(sess, p) {
  if (!inRoles_(sess, ['ADMIN','ASISTEN'])) return { ok:false, error:'Hanya ADMIN/ASISTEN' };

  const ctx = resolveProgramContext_(sess, p || {}, true);
  const programId = ctx.program_id;

  ensureColumns_('Mentors', ['program_id','estate','divisi','updated_at']);

  const mentor_id = String(p.mentor_id||'').trim() || Utilities.getUuid();
  const exists = findById_('Mentors', 'mentor_id', mentor_id);

  const row = {
    mentor_id,
    program_id: String(programId||'').trim(),
    nik: String(p.nik||'').trim(),
    name: String(p.name||'').trim(),
    estate: String(p.estate||'').trim(),
    divisi: String(p.divisi||'').trim(),
    active: 'TRUE',
    experience_years: String(p.experience_years||'').trim(),
    notes: String(p.notes||'').trim(),
    updated_at: nowIso_()
  };
  if (!row.nik || !row.name) return { ok:false, error:'NIK & Nama mentor wajib' };

  if (!exists) {
    row.created_at = nowIso_();
    appendRow_('Mentors', row);
    audit_(sess.user.nik, 'CREATE', 'Mentors', mentor_id, row);
  } else {
    // ✅ jangan overwrite created_at
    writeRowById_('Mentors', 'mentor_id', mentor_id, row, true);
    audit_(sess.user.nik, 'UPDATE', 'Mentors', mentor_id, { nik: row.nik, name: row.name });
  }
  return { ok:true, mentor_id };
}

function assignMentor_(sess, p) {
  if (!inRoles_(sess, ['ADMIN','ASISTEN'])) return { ok:false, error:'Hanya ADMIN/ASISTEN' };

  // context program UI (opsional, untuk validasi)
  const ctx = resolveProgramContext_(sess, p || {}, true);
  const activeProgramId = ctx.program_id; // boleh kosong kalau UI selalu kirim program_id

  ensureColumns_('Participants', [
    'participant_id','program_id','candidate_id','nik','name','family_id','category','status',
    'start_date','end_date','mentor_id','estate','divisi','ancak',
    'trial_start','trial_end','created_at','updated_at'
  ]);

  ensureColumns_('Pairings', [
    'pairing_id','program_id','mentor_id','participant_id','start_date','end_date',
    'status','assigned_by','assigned_at'
  ]);

  const mentor_id = String(p.mentor_id||'').trim();
  const participant_id = String(p.participant_id||'').trim();
  if (!mentor_id || !participant_id) return { ok:false, error:'mentor_id & participant_id wajib' };

  const reqProgramId = String(p.program_id || '').trim(); // dari UI (opsional)

  // --- Ambil peserta (sumber kebenaran program_id) ---
  const part = getRowById_('Participants', 'participant_id', participant_id);
  if (!part) return { ok:false, error:'Peserta tidak ditemukan.' };

  const targetProgramId = String(part.program_id || '').trim();
  if (!targetProgramId) return { ok:false, error:'Peserta tidak memiliki program_id.' };

  // Jika UI mengirim program_id, pastikan sama
  if (reqProgramId && reqProgramId !== targetProgramId) {
    return {
      ok:false,
      error:`Program context tidak sesuai. Peserta ini milik program ${targetProgramId}, bukan ${reqProgramId}.`
    };
  }

  // Jika sistem masih pakai activeProgramId context, pastikan tidak tabrakan (opsional tapi aman)
  if (activeProgramId && String(activeProgramId) !== String(targetProgramId)) {
    // tidak dibuat hard-error agar fleksibel, tapi biasanya lebih aman jadi error:
    // return { ok:false, error:`Active program context (${activeProgramId}) tidak sesuai dengan program peserta (${targetProgramId}).` };
  }

  const startDate = toISODate_(p.start_date);
  const endDate = toISODate_(p.end_date);
  const applyFamily = String(p.apply_family ?? 'TRUE').trim().toUpperCase() !== 'FALSE';

  // --- Helper: buat pairing per peserta dengan aturan idempotent ---
  function createOrGetPairingFor_(pid) {
    const pairs = sheetToObjects_('Pairings').filter(x =>
      String(x.program_id||'') === String(targetProgramId) &&
      String(x.status||'') === 'ACTIVE'
    );

    const existingForParticipant = pairs.find(x => String(x.participant_id||'') === String(pid));
    if (existingForParticipant) {
      // Idempotent:
      // - Jika sudah pairing dengan mentor yang sama => sukses, return pairing_id lama
      // - Jika pairing dengan mentor berbeda => error
      if (String(existingForParticipant.mentor_id||'') === String(mentor_id)) {
        return { ok:true, pairing_id: String(existingForParticipant.pairing_id||'') , existed:true };
      }
      return { ok:false, error:'Peserta sudah memiliki pairing aktif pada program ini (mentor berbeda).' };
    }

    const pairing = {
      pairing_id: Utilities.getUuid(),
      program_id: targetProgramId,
      mentor_id,
      participant_id: pid,
      start_date: startDate,
      end_date: endDate,
      status: 'ACTIVE',
      assigned_by: sess.user.nik,
      assigned_at: nowIso_()
    };
    appendRow_('Pairings', pairing);
    audit_(sess.user.nik, 'ASSIGN', 'Pairings', pairing.pairing_id, pairing);

    // Update participant mentor_id + status sesuai kategori
    const pt = getRowById_('Participants', 'participant_id', pid) || {};
    const cat = String((pt.category) || '').trim().toUpperCase();

    if (cat === 'A') {
      // kategori A: tidak wajib TANDEM, tapi mentor_id boleh disimpan
      writeRowById_('Participants', 'participant_id', pid, {
        mentor_id,
        updated_at: nowIso_()
      }, true);
    } else {
      // kategori B: setelah pairing => TANDEM + trial_start default hari ini jika kosong
      const upd = {
        mentor_id,
        status: 'TANDEM',
        trial_start: String(pt.trial_start||'').trim()
          ? pt.trial_start
          : Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'),
        updated_at: nowIso_()
      };
      writeRowById_('Participants', 'participant_id', pid, upd, true);
    }

    return { ok:true, pairing_id: pairing.pairing_id, existed:false };
  }

  // 1) pairing utama
  const main = createOrGetPairingFor_(participant_id);
  if (!main.ok) return main;

  const pairingIds = [];
  const autoAppliedParticipantIds = [];
  if (main.pairing_id) pairingIds.push(main.pairing_id);

  // 2) auto apply ke family (opsional, hanya kategori B)
  if (applyFamily) {
    try {
      const fam = String(part.family_id||'').trim();
      if (fam) {
        const allParts = sheetToObjects_('Participants').filter(x =>
          String(x.program_id||'') === String(targetProgramId)
        );

        const famParts = allParts.filter(x =>
          String(x.family_id||'').trim() === fam &&
          String(x.participant_id||'') !== String(participant_id)
        );

        famParts.forEach(fp => {
          const pid = String(fp.participant_id||'').trim();
          const cat = String(fp.category||'').trim().toUpperCase();
          if (!pid) return;
          if (cat !== 'B') return; // hanya kategori B

          const rr = createOrGetPairingFor_(pid);
          if (rr.ok) {
            if (!rr.existed) autoAppliedParticipantIds.push(pid);
            if (rr.pairing_id) pairingIds.push(rr.pairing_id);
          }
          // jika gagal karena sudah pairing mentor berbeda, biarkan (tidak memblok pairing utama)
        });
      }
    } catch (e) {}
  }

  return {
    ok:true,
    pairing_id: main.pairing_id || '',
    pairing_ids: pairingIds,
    auto_applied_participant_ids: autoAppliedParticipantIds,
    existed: !!main.existed
  };
}

function myMentees_(sess, p) {
  if (String(sess.user.role||'').toUpperCase() !== 'MENTOR') return { ok:false, error:'Hanya MENTOR' };

  const ctx = resolveProgramContext_(sess, p || {}, true);
  const activeProgramId = ctx.program_id;

  ensureColumns_('Mentors', ['program_id','estate','divisi','updated_at']);
  const mentors = sheetToObjects_('Mentors').filter(x => String(x.program_id||'') === String(activeProgramId));

  const myMentor = mentors.find(m => String(m.nik||'') === String(sess.user.nik||''));
  if (!myMentor) return { ok:true, items: [] };

  const pairings = sheetToObjects_('Pairings').filter(x =>
    String(x.program_id||'') === String(activeProgramId) &&
    String(x.mentor_id||'') === String(myMentor.mentor_id||'') &&
    String(x.status||'') === 'ACTIVE'
  );

  const parts = sheetToObjects_('Participants');
  const partById = {};
  parts.forEach(pt => partById[String(pt.participant_id||'')] = pt);

  const items = pairings.map(px => {
    const pt = partById[String(px.participant_id||'')] || {};
    return {
      pairing_id: px.pairing_id,
      participant_id: px.participant_id,
      participant_name: pt.name || '',
      participant_nik: pt.nik || '',
      participant_status: pt.status || '',
      start_date: px.start_date || ''
    };
  });

  return { ok:true, items };
}

// -------------------- Daily Logs --------------------
function submitDailyLog_(sess, p) {
  if (!inRoles_(sess, ['ADMIN','ASISTEN','MANDOR','MENTOR'])) return { ok:false, error:'Role tidak diizinkan' };

  const ctx = resolveProgramContext_(sess, p || {}, true);
  const activeProgramId = ctx.program_id;
  if (!activeProgramId) return { ok:false, error:'activeProgramId belum diset' };

  // ✅ Ensure header sesuai sheet Anda
  ensureColumns_('DailyLogs', [
    'log_id','program_id','participant_id','mentor_id','date','attendance','tonnage','mutu_grade',
    'losses_brondolan','apd_ok','discipline_score','mentor_note','mandor_note','assistant_note',
    'created_by','created_at','updated_at'
  ]);

  const participant_id = String(p.participant_id||'').trim();
  const date = String(p.date||'').trim();
  if (!participant_id || !date) return { ok:false, error:'participant_id & date wajib' };

  // mentor_id dari payload atau pairing aktif
  let mentor_id = String(p.mentor_id||'').trim();
  if (!mentor_id) {
    const pair = sheetToObjects_('Pairings').find(x =>
      String(x.program_id||'')===activeProgramId &&
      String(x.participant_id||'')===participant_id &&
      String(x.status||'')==='ACTIVE'
    );
    mentor_id = pair ? String(pair.mentor_id||'') : '';
  }

  // notes by role
  const note = String(p.note||'').trim();
  const role = String(sess.user.role||'').toUpperCase();
  const mentor_note = (note && role==='MENTOR') ? note : '';
  const mandor_note = (note && role==='MANDOR') ? note : '';
  const assistant_note = (note && (role==='ADMIN' || role==='ASISTEN')) ? note : '';

  const baseData = {
    program_id: activeProgramId,
    participant_id,
    mentor_id,
    date,
    attendance: String(p.attendance||'').trim(),
    tonnage: String(p.tonnage||'').trim(),
    mutu_grade: String(p.mutu_grade||'').trim(),
    losses_brondolan: String(p.losses_brondolan||'').trim(),
    apd_ok: (String(p.apd_ok||'').trim() || 'TRUE'),
    discipline_score: String(p.discipline_score||'').trim()
  };

  // UPSERT by (program_id, participant_id, date)
  const logs = sheetToObjects_('DailyLogs');
  const existing = logs.find(x =>
    String(x.program_id||'')===activeProgramId &&
    String(x.participant_id||'')===participant_id &&
    String(x.date||'')===date
  );

  if (existing) {
    const logId = String(existing.log_id||'').trim();
    if (!logId) return { ok:false, error:'Data existing DailyLogs ditemukan tetapi log_id kosong. Periksa sheet DailyLogs.' };

    // ✅ patch update: jangan overwrite created_at/created_by
    const patch = Object.assign({}, baseData, {
      updated_at: nowIso_()
    });

    // ✅ hanya update note sesuai role yang mengirim
    if (mentor_note) patch.mentor_note = mentor_note;
    if (mandor_note) patch.mandor_note = mandor_note;
    if (assistant_note) patch.assistant_note = assistant_note;

    writeRowById_('DailyLogs', 'log_id', logId, patch, true);
    audit_(sess.user.nik, 'UPDATE', 'DailyLogs', logId, { participant_id, date });
    return { ok:true, log_id: logId, mode:'UPDATED' };
  }

  const row = Object.assign({}, baseData, {
    log_id: Utilities.getUuid(),
    mentor_note,
    mandor_note,
    assistant_note,
    created_by: sess.user.nik,
    created_at: nowIso_(),
    updated_at: nowIso_()
  });

  appendRow_('DailyLogs', row);
  audit_(sess.user.nik, 'CREATE', 'DailyLogs', row.log_id, { participant_id, date });
  return { ok:true, log_id: row.log_id, mode:'CREATED' };
}

function getDailyLogs_(sess, p) {
  const ctx = resolveProgramContext_(sess, p || {}, true);
  const activeProgramId = ctx.program_id;
  if (!activeProgramId) return { ok:false, error:'activeProgramId belum diset' };
  const date = (p.date||'').trim();
  const q = (p.q||'').trim().toLowerCase();

  const logs = sheetToObjects_('DailyLogs').filter(x => String(x.program_id||'') === activeProgramId && (!date || String(x.date||'') === date));
  const parts = sheetToObjects_('Participants').filter(x => String(x.program_id||'') === activeProgramId);
  const byId = {};
  parts.forEach(pt => byId[String(pt.participant_id||'')] = pt);

  const outAll = logs.map(l => {
    const pt = byId[String(l.participant_id||'')] || {};
    return Object.assign({}, l, {
      participant_name: pt.name || '',
      participant_nik: pt.nik || ''
    });
  }).filter(x => {
    if (!q) return true;
    return String(x.participant_name||'').toLowerCase().includes(q) || String(x.participant_nik||'').toLowerCase().includes(q);
  });

  let out = outAll;

  if (!isAdmin_(sess)) {
    if (String(sess.user.role||'') === 'MENTOR') {
      const my = myMentees_(sess);
      const ids = new Set((my && my.ok && Array.isArray(my.items) ? my.items : []).map(x=>String(x.participant_id||'')));
      out = out.filter(x => ids.has(String(x.participant_id||'')));
    } else {
      out = out.filter(x => {
        const pt = byId[String(x.participant_id||'')] || {};
        return scopeMatchesEstateDivisi_(sess, pt.estate, pt.divisi);
      });
    }
  }

  return { ok:true, logs: out.slice(0, 500) };
}

// -------------------- Weekly Recap --------------------
function computeWeeklyRecap_(sess, p) {
  if (!inRoles_(sess, ['ADMIN','ASISTEN'])) return { ok:false, error:'Hanya ADMIN/ASISTEN' };
  const ctx = resolveProgramContext_(sess, p || {}, true);
  const activeProgramId = ctx.program_id;
  if (!activeProgramId) return { ok:false, error:'activeProgramId belum diset' };

  const anyDateStr = (p.any_date||'').trim();
  if (!anyDateStr) return { ok:false, error:'any_date wajib' };
  const anyDate = new Date(anyDateStr + 'T00:00:00');
  if (isNaN(anyDate.getTime())) return { ok:false, error:'Tanggal tidak valid' };

  const ws = weekStartMonday_(anyDate);
  const we = new Date(ws.getTime() + 6*24*3600*1000);

  const week_start = formatDate_(ws);
  const week_end = formatDate_(we);

  const logs = sheetToObjects_('DailyLogs').filter(x =>
    String(x.program_id||'') === activeProgramId &&
    String(x.date||'') >= week_start &&
    String(x.date||'') <= week_end
  );
  const byParticipant = {};
  logs.forEach(l => {
    const pid = String(l.participant_id||'');
    if (!byParticipant[pid]) byParticipant[pid] = [];
    byParticipant[pid].push(l);
  });

  const participants = sheetToObjects_('Participants').filter(x => String(x.program_id||'') === activeProgramId);
  let upserts = 0;

  participants.forEach(pt => {
    const pid = String(pt.participant_id||'');
    const arr = byParticipant[pid] || [];
    if (!arr.length) return;

    const ton = avg_(arr.map(x => num_(x.tonnage)));
    const disc = avg_(arr.map(x => num_(x.discipline_score)));
    const attendancePct = pct_(arr.filter(x => String(x.attendance||'') === 'HADIR').length, arr.length);
    const apdPct = pct_(arr.filter(x => String(x.apd_ok||'') === 'TRUE').length, arr.length);

    const recap = {
      recap_id: Utilities.getUuid(),
      program_id: activeProgramId,
      participant_id: pid,
      week_no: weekNoFromStart_(activeProgramId, ws),
      week_start,
      week_end,
      avg_tonnage: isFinite(ton) ? String(round2_(ton)) : '',
      avg_mutu: mode_(arr.map(x => String(x.mutu_grade||'').trim()).filter(Boolean)),
      losses_rate: '', // bisa dihitung jika punya standar
      attendance_pct: String(round2_(attendancePct)),
      apd_pct: String(round2_(apdPct)),
      discipline_avg: isFinite(disc) ? String(round2_(disc)) : '',
      recommendation: '',
      reviewed_by: sess.user.nik,
      reviewed_at: nowIso_()
    };

    // Upsert by (program_id, participant_id, week_start)
    const existing = findWeeklyRecap_(activeProgramId, pid, week_start);
    if (existing) {
      writeRowById_('WeeklyRecaps', 'recap_id', existing.recap_id, recap);
    } else {
      appendRow_('WeeklyRecaps', recap);
    }
    upserts++;
  });

  audit_(sess.user.nik, 'COMPUTE', 'WeeklyRecaps', activeProgramId, { week_start, week_end, upserts });
  return { ok:true, week_start, week_end, upserts };
}

function findWeeklyRecap_(programId, participantId, weekStart) {
  const recaps = sheetToObjects_('WeeklyRecaps').filter(x => String(x.program_id||'')===programId && String(x.participant_id||'')===participantId && String(x.week_start||'')===weekStart);
  return recaps.length ? recaps[recaps.length-1] : null;
}

function weekNoFromStart_(programId, weekStartDateObj) {
  const programs = sheetToObjects_('Programs');
  const prog = programs.find(x => String(x.program_id||'') === String(programId||''));
  if (!prog || !prog.period_start) return '';
  const start = new Date(String(prog.period_start) + 'T00:00:00');
  if (isNaN(start.getTime())) return '';
  const ws = weekStartMonday_(start);
  const diffDays = Math.floor((weekStartDateObj.getTime() - ws.getTime()) / (24*3600*1000));
  return String(1 + Math.floor(diffDays / 7));
}

// -------------------- Graduation --------------------
function listGraduation_(sess, p) {
  if (!inRoles_(sess, ['ADMIN','ASISTEN'])) return { ok:false, error:'Hanya ADMIN/ASISTEN' };
  const ctx = resolveProgramContext_(sess, p || {}, true);
  const activeProgramId = ctx.program_id;

  const parts = sheetToObjects_('Participants').filter(x => String(x.program_id||'') === String(activeProgramId));
  const grads = sheetToObjects_('Graduations').filter(x => String(x.program_id||'') === String(activeProgramId));

  const latestByParticipant = {};
  grads.forEach(g => {
    const pid = String(g.participant_id||'');
    if (!pid) return;
    const ts = String(g.approved_at||'');
    if (!latestByParticipant[pid] || String(latestByParticipant[pid].approved_at||'') < ts) latestByParticipant[pid] = g;
  });

  const items = parts.map(pt => {
    const g = latestByParticipant[String(pt.participant_id||'')] || {};
    return {
      participant_id: pt.participant_id,
      nik: pt.nik,
      name: pt.name,
      status: pt.status,
      decision: g.decision || ''
    };
  });

  return { ok:true, items };
}

function graduateParticipant_(sess, p) {
  if (!inRoles_(sess, ['ADMIN','ASISTEN'])) return { ok:false, error:'Hanya ADMIN/ASISTEN' };
  const ctx = resolveProgramContext_(sess, p || {}, true);
  const activeProgramId = ctx.program_id;
  if (!activeProgramId) return { ok:false, error:'activeProgramId belum diset' };
  const participant_id = (p.participant_id||'').trim();
  const decision = (p.decision||'').trim();
  const reason = (p.reason||'').trim();

  if (!participant_id || !decision) return { ok:false, error:'participant_id & decision wajib' };
  if (decision === 'TIDAK_LULUS' && !reason) return { ok:false, error:'Alasan wajib untuk TIDAK_LULUS' };

  const row = {
    grad_id: Utilities.getUuid(),
    program_id: activeProgramId,
    participant_id,
    decision,
    lulus_flag: (decision === 'LULUS') ? 'TRUE' : 'FALSE',
    reason,
    approved_by: sess.user.nik,
    approved_at: nowIso_()
  };
  appendRow_('Graduations', row);

  // update participant status
  const newStatus = (decision === 'LULUS') ? 'GRADUATED' : 'FAILED';
  const trialStart = formatDate_(new Date());
  const trialEnd = formatDate_(addMonths_(new Date(), 3));
  writeRowById_('Participants', 'participant_id', participant_id, {
    status: newStatus,
    trial_start: (decision==='LULUS') ? trialStart : '',
    trial_end: (decision==='LULUS') ? trialEnd : '',
    updated_at: nowIso_()
  }, true);

  audit_(sess.user.nik, 'GRADUATE', 'Graduations', row.grad_id, row);

  // create mentor incentives if participant has mentor_id
  if (decision === 'LULUS') {
    createMentorIncentivesIfAny_(sess.user.nik, activeProgramId, participant_id, trialEnd);
  }

  return { ok:true };
}

// -------------------- Certificates --------------------

function ensureCertificatesColumns_() {
  ensureColumns_('Certificates', [
    'cert_id','program_id','person_type','person_id','nik','name',
    'certificate_no','verify_code','issue_date','template',
    'issued_by','issued_at','drive_file_id','pdf_url','qr_url',
    'updated_at'
  ]);
}

function issueCertificate_(sess, p) {
  if (!inRoles_(sess, ['ADMIN'])) return { ok:false, error:'Hanya ADMIN' };
  ensureCertificatesColumns_();
  const ctx = resolveProgramContext_(sess, p || {}, true);
  const activeProgramId = ctx.program_id;
  if (!activeProgramId) return { ok:false, error:'activeProgramId belum diset' };

  const person_type = (p.person_type||'').trim(); // PESERTA / MENTOR
  const person_id = (p.person_id||'').trim();
  if (!person_type || !person_id) return { ok:false, error:'person_type & person_id wajib' };

  let nik='', name='';
  if (person_type === 'PESERTA') {
    const pt = findById_('Participants', 'participant_id', person_id);
    if (!pt) return { ok:false, error:'Peserta tidak ditemukan' };
    nik = pt.nik || '';
    name = pt.name || '';
  } else if (person_type === 'MENTOR') {
    const m = findById_('Mentors', 'mentor_id', person_id);
    if (!m) return { ok:false, error:'Mentor tidak ditemukan' };
    nik = m.nik || '';
    name = m.name || '';
  } else {
    return { ok:false, error:'person_type invalid' };
  }

  // Cegah duplikat sertifikat utk orang yang sama di program yang sama
  const existing = sheetToObjects_('Certificates').find(x =>
    String(x.program_id||'')===activeProgramId &&
    String(x.person_type||'')===person_type &&
    String(x.person_id||'')===person_id
  );
  if (existing) return { ok:false, error:'Sertifikat sudah pernah diterbitkan untuk orang ini pada program aktif.' };

  const certNo = nextCertificateNo_();
  const verifyCode = randomCode_(14);

  const cert = {
    cert_id: Utilities.getUuid(),
    program_id: activeProgramId,
    person_type,
    person_id,
    nik,
    name,
    certificate_no: certNo,
    verify_code: verifyCode,
    issue_date: formatDate_(new Date()),
    template: (person_type === 'PESERTA') ? 'CERT_PESERTA_V1' : 'CERT_MENTOR_V1',
    issued_by: sess.user.nik,
    issued_at: nowIso_(),
    drive_file_id: '',
    pdf_url: '',
    qr_url: '',
    updated_at: nowIso_()
  };

  // Generate PDF + QR (Drive)
  const pdfRes = generateCertificatePdf_(cert);
  if (pdfRes && pdfRes.ok) {
    cert.drive_file_id = pdfRes.fileId || '';
    cert.pdf_url = pdfRes.url || '';
    cert.qr_url = pdfRes.qrUrl || '';
  }

  appendRow_('Certificates', cert);
  audit_(sess.user.nik, 'ISSUE', 'Certificates', cert.cert_id, { certificate_no: certNo, person_type, nik, verify_code: verifyCode });
  return { ok:true, certificate_no: certNo, verify_code: verifyCode, pdf_url: cert.pdf_url };
}

function listCertificates_(sess, p) {
  p = p || {};
  const ctx = resolveProgramContext_(sess, p, true);
  const activeProgramId = ctx.program_id;

  // Ambil cert untuk program aktif (atau jika admin override program_id lewat p sudah ditangani resolveProgramContext_)
  let items = sheetToObjects_('Certificates')
    .filter(x => !activeProgramId || String(x.program_id || '') === String(activeProgramId));

  // Non-admin: batasi sesuai scope
  if (!isAdmin_(sess)) {
    // Ambil participants program aktif (untuk mapping estate/divisi)
    const parts = sheetToObjects_('Participants')
      .filter(x => !activeProgramId || String(x.program_id || '') === String(activeProgramId));

    const byId = {};
    parts.forEach(pt => { byId[String(pt.participant_id || '')] = pt; });

    const role = String(sess.user.role || '').trim().toUpperCase();

    if (role === 'MENTOR') {
      const my = myMentees_(sess, p);
      const allowed = new Set(
        (my && my.ok && Array.isArray(my.items) ? my.items : [])
          .map(x => String(x.participant_id || ''))
      );

      // NOTE: Certificates sheet pakai person_type/person_id.
      // Untuk mentor role: biasanya yang ingin dilihat adalah sertifikat peserta bimbingannya (person_type=PESERTA).
      items = items.filter(c => {
        const pt = String(c.person_type || '').toUpperCase();
        const pid = String(c.person_id || ''); // person_id untuk PESERTA = participant_id
        return pt === 'PESERTA' && allowed.has(pid);
      });

    } else {
      // ASISTEN / MANDOR dll → filter berdasarkan estate/divisi dari participant (untuk cert peserta)
      items = items.filter(c => {
        const pt = String(c.person_type || '').toUpperCase();
        if (pt !== 'PESERTA') return false; // non-admin umumnya tidak perlu lihat cert mentor
        const pid = String(c.person_id || '');
        const part = byId[pid] || {};
        return scopeMatchesEstateDivisi_(sess, part.estate, part.divisi);
      });
    }
  }

  // Sort terbaru dulu (issued_at), fallback ke row order
  items.sort((a, b) => String(b.issued_at || '').localeCompare(String(a.issued_at || '')));

  // Batasi payload
  return { ok: true, items: items.slice(0, 300) };
}

function nextCertificateNo_() {
  const year = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy');
  const items = sheetToObjects_('Certificates');
  const prefix = 'SP-' + year + '-';
  let max = 0;
  items.forEach(c => {
    const no = String(c.certificate_no||'');
    if (no.startsWith(prefix)) {
      const n = parseInt(no.slice(prefix.length), 10);
      if (!isNaN(n) && n > max) max = n;
    }
  });
  return prefix + String(max + 1).padStart(4, '0');
}

// -------------------- Incentives --------------------
function listMentorIncentives_(sess, p) {
  p = p || {};
  if (!inRoles_(sess, ['ADMIN','ASISTEN'])) return { ok:false, error:'Hanya ADMIN/ASISTEN' };

  const ctx = resolveProgramContext_(sess, p, true);
  const activeProgramId = ctx.program_id;

  const items = sheetToObjects_('MentorIncentives')
    .filter(x => !activeProgramId || String(x.program_id || '') === String(activeProgramId));

  ensureColumns_('Mentors', ['program_id','estate','divisi','updated_at']);

  const mentors = sheetToObjects_('Mentors')
    .filter(x => !activeProgramId || String(x.program_id || '') === String(activeProgramId));

  const mById = {};
  mentors.forEach(m => { mById[String(m.mentor_id || '')] = m; });

  const parts = sheetToObjects_('Participants')
    .filter(x => !activeProgramId || String(x.program_id || '') === String(activeProgramId));

  const pById = {};
  parts.forEach(pt => { pById[String(pt.participant_id || '')] = pt; });

  // ✅ FIX: let (bukan const)
  let out = items.map(x => {
    const m = mById[String(x.mentor_id || '')] || {};
    const pt = pById[String(x.participant_id || '')] || {};
    return Object.assign({}, x, {
      mentor_name: m.name || '',
      mentor_nik: m.nik || '',
      participant_name: pt.name || '',
      participant_nik: pt.nik || '',
      participant_estate: pt.estate || '',
      participant_divisi: pt.divisi || ''
    });
  });

  // Scope Asisten
  if (!isAdmin_(sess)) {
    out = out.filter(x => scopeMatchesEstateDivisi_(sess, x.participant_estate, x.participant_divisi));
  }

  out.sort((a, b) => {
    const aKey = String(a.verified_at || a.paid_at || a.due_date || '');
    const bKey = String(b.verified_at || b.paid_at || b.due_date || '');
    return bKey.localeCompare(aKey);
  });

  return { ok:true, items: out.slice(0, 500) };
}

function verifyIncentive_(sess, p) {
  ensureMentorIncentivesColumns_();
  if (!inRoles_(sess, ['ADMIN','ASISTEN'])) return { ok:false, error:'Hanya ADMIN/ASISTEN' };
  const incentive_id = (p.incentive_id||'').trim();
  const status = (p.status||'').trim() || 'VERIFIED';
  if (!incentive_id) return { ok:false, error:'incentive_id kosong' };
  writeRowById_('MentorIncentives', 'incentive_id', incentive_id, {
    status,
    verified_by: sess.user.nik,
    verified_at: nowIso_()
  }, true);
  audit_(sess.user.nik, 'VERIFY', 'MentorIncentives', incentive_id, { status });
  return { ok:true };
}

function ensureMentorIncentivesColumns_(){
  ensureColumns_('MentorIncentives', [
    'incentive_id','program_id','mentor_id','participant_id','stage','amount','due_date',
    'status','verified_by','verified_at','paid_at','notes'
  ]);
}
function createMentorIncentivesIfAny_(userNik, programId, participantId, trialEndDateStr) {
  ensureMentorIncentivesColumns_();
  const pt = findById_('Participants', 'participant_id', participantId);
  if (!pt) return;

  const mentorId = String(pt.mentor_id||'').trim();
  if (!mentorId) return;

  // prevent duplicate (any stage)
  const existing = sheetToObjects_('MentorIncentives').find(x =>
    String(x.program_id||'')===String(programId) &&
    String(x.mentor_id||'')===String(mentorId) &&
    String(x.participant_id||'')===String(participantId)
  );
  if (existing) return;

  const amt3m = getSettingNumber_('incentive_3m_amount', 1000000);
  const amt1y = getSettingNumber_('incentive_12m_amount', 1000000);
  const enable3m = String(getSetting_('incentive_3m_enabled')||'TRUE').toUpperCase() !== 'FALSE';
  const enable1y = String(getSetting_('incentive_12m_enabled')||'TRUE').toUpperCase() !== 'FALSE';

  if (enable3m) {
    const due1 = trialEndDateStr || formatDate_(addMonths_(new Date(), 3));
    appendRow_('MentorIncentives', {
      incentive_id: Utilities.getUuid(),
      program_id: programId,
      mentor_id: mentorId,
      participant_id: participantId,
      stage: 'AFTER_TRIAL_3M',
      amount: String(amt3m),
      due_date: due1,
      status: 'PENDING',
      verified_by: '',
      verified_at: '',
      paid_at: '',
      notes: ''
    });
  }

  if (enable1y) {
    // Idealnya dihitung dari trialEndDateStr, tapi jika Anda ingin "12 bulan dari sekarang", biarkan seperti ini.
    // Saya pakai basis trialEndDateStr bila ada agar konsisten.
    const base = trialEndDateStr ? new Date(String(trialEndDateStr) + 'T00:00:00') : new Date();
    const due2 = formatDate_(addMonths_(isNaN(base.getTime()) ? new Date() : base, 12));

    appendRow_('MentorIncentives', {
      incentive_id: Utilities.getUuid(),
      program_id: programId,
      mentor_id: mentorId,
      participant_id: participantId,
      stage: 'AFTER_1Y',
      amount: String(amt1y), // ✅ FIX: sebelumnya amt3m
      due_date: due2,
      status: 'PENDING',
      verified_by: '',
      verified_at: '',
      paid_at: '',
      notes: ''
    });
  }

  audit_(userNik, 'CREATE', 'MentorIncentives', participantId, { mentor_id: mentorId, participant_id: participantId });
}

// -------------------- Helpers --------------------
function respond_(p, data) {
  const cb = (p && p.callback) ? String(p.callback) : '';
  const out = cb ? (cb + '(' + JSON.stringify(data) + ');') : JSON.stringify(data);
  return ContentService
    .createTextOutput(out)
    .setMimeType(cb ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
}

function inRoles_(sess, roles) {
  const r = String(sess && sess.user && sess.user.role ? sess.user.role : '').trim().toUpperCase();
  const norm = (roles || []).map(x => String(x||'').trim().toUpperCase());

  // treat ADMINISTRATOR as ADMIN
  if (r === 'ADMINISTRATOR' && norm.indexOf('ADMIN') >= 0) return true;

  return norm.indexOf(r) >= 0;
}

function getUserEstate_(sess){ return String(sess && sess.user && sess.user.estate ? sess.user.estate : '').trim().toUpperCase(); }
function getUserDivisi_(sess){
  const u = (sess && sess.user) ? sess.user : {};
  return String(u.divisi || '').trim();
}

function scopeMatchesEstateDivisi_(sess, estate, divisi){
  const uEstate = getUserEstate_(sess);
  const uDiv = getUserDivisi_(sess);
  const e = String(estate||'').trim().toUpperCase();
  const d = String(divisi||'').trim();
  if (!uEstate) return false;
  if (e && e !== uEstate) return false;
  if (uDiv && d && d !== uDiv) return false;
  return true;
}

// ===============================
// PATCH: Date normalizer to ISO yyyy-MM-dd
// ===============================
function toISODate_(v) {
  const s = String(v||'').trim();
  if (!s) return '';
  // already ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // dd-mm-yyyy
  if (/^\d{2}-\d{2}-\d{4}$/.test(s)) {
    const [dd,mm,yy] = s.split('-');
    return `${yy}-${mm}-${dd}`;
  }
  // try parse Date string
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return s; // fallback (biar tidak blank)
}

function nowIso_() {
  return toIso_(new Date());
}

function toIso_(d) {
  return Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss");
}

function formatDate_(d) {
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function isoToDmy_(iso){
  const s = String(iso||'').trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return s;
  return m[3] + '-' + m[2] + '-' + m[1];
}

function addMonths_(d, months) {
  const nd = new Date(d.getTime());
  nd.setMonth(nd.getMonth() + months);
  return nd;
}

function weekStartMonday_(d) {
  const nd = new Date(d.getTime());
  const day = nd.getDay(); // 0 Sunday
  const diff = (day === 0 ? -6 : 1 - day);
  nd.setDate(nd.getDate() + diff);
  nd.setHours(0,0,0,0);
  return nd;
}

function num_(v) {
  const n = parseFloat(String(v||'').replace(',', '.'));
  return isNaN(n) ? NaN : n;
}

function avg_(arr) {
  const xs = arr.filter(x => typeof x === 'number' && isFinite(x));
  if (!xs.length) return NaN;
  return xs.reduce((a,b)=>a+b,0)/xs.length;
}

function round2_(n) {
  return Math.round(n * 100) / 100;
}

function pct_(a, b) {
  if (!b) return 0;
  return (a / b) * 100;
}

function mode_(arr) {
  if (!arr || !arr.length) return '';
  const m = {};
  arr.forEach(x => { m[x] = (m[x]||0)+1; });
  let best = '', bestc = 0;
  Object.keys(m).forEach(k => { if (m[k] > bestc) { bestc = m[k]; best = k; } });
  return best;
}

function audit_(userNik, action, entity, entityId, detail) {
  try {
    appendRow_('AuditLogs', {
      audit_id: Utilities.getUuid(),
      ts: nowIso_(),
      user_nik: userNik,
      action: action,
      entity: entity,
      entity_id: entityId,
      detail_json: JSON.stringify(detail || {})
    });
  } catch (e) {}
}

function getSetting_(key) {
  const s = sheetToObjects_('Settings');
  const r = s.find(x => String(x.key||'') === key);
  return r ? String(r.value||'') : '';
}

function setSetting_(key, value) {
  const sheetName = 'Settings';
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sh = ss.getSheetByName(CONFIG.SHEETS[sheetName]);
  const values = sh.getDataRange().getValues();
  const headers = values[0];
  const keyIdx = headers.indexOf('key');
  const valIdx = headers.indexOf('value');
  for (let i=1;i<values.length;i++) {
    if (String(values[i][keyIdx]||'') === key) {
      sh.getRange(i+1, valIdx+1).setValue(value);
      return;
    }
  }
  sh.appendRow([key, value]);
}

function buildPlacementState_(participants) {
  // state: { "SRIE|1": {max:12, used:{'12':2,'11':1}} }
  const state = {};
  (participants||[]).forEach(r => {
    const estate = String(r.estate||'').trim().toUpperCase();
    const divisi = String(r.divisi||'').trim();
    const ancak = String(r.ancak||'').trim();
    if (!estate || !divisi || !ancak) return;

    const key = estate + '|' + divisi;
    if (!state[key]) state[key] = { max: 0, used: {} };

    const n = parseInt(ancak, 10);
    if (isFinite(n)) state[key].max = Math.max(state[key].max, n);
    state[key].used[ancak] = (state[key].used[ancak] || 0) + 1;
  });
  return state;
}

function buildFamilyPlacementMap_(participants) {
  const map = {};
  (participants||[]).forEach(r => {
    const fid = String(r.family_id||'').trim();
    const estate = String(r.estate||'').trim().toUpperCase();
    const divisi = String(r.divisi||'').trim();
    const ancak = String(r.ancak||'').trim();
    if (!fid) return;
    if (!estate || !divisi || !ancak) return;
    if (!map[fid]) map[fid] = { estate, divisi, ancak };
  });
  return map;
}

function assignNextAncak_(placementState, estate, divisi) {
  estate = String(estate||'').trim().toUpperCase();
  divisi = String(divisi||'').trim();
  if (!estate || !divisi) return '';

  const key = estate + '|' + divisi;
  if (!placementState[key]) placementState[key] = { max: 0, used: {} };

  // Jika admin menyiapkan list ancak di Settings: ancakList:SRIE-1 = ["10","11","12","13"]
  const listKey = 'ancakList:' + estate + '-' + divisi;
  const rawList = getSetting_(listKey);
  if (rawList) {
    try {
      const arr = JSON.parse(rawList);
      if (Array.isArray(arr) && arr.length) {
        // pilih yang paling sedikit dipakai
        let best = String(arr[0]);
        let bestCount = placementState[key].used[best] || 0;
        arr.forEach(a => {
          const aa = String(a);
          const c = placementState[key].used[aa] || 0;
          if (c < bestCount) { best = aa; bestCount = c; }
        });
        placementState[key].used[best] = (placementState[key].used[best] || 0) + 1;
        return best;
      }
    } catch(e) {}
  }

  // fallback: increment dari max
  placementState[key].max = (placementState[key].max || 0) + 1;
  const next = String(placementState[key].max);
  placementState[key].used[next] = (placementState[key].used[next] || 0) + 1;
  return next;
}


// -------------------- Program Context (Multi Estate) --------------------
// activeProgramId disimpan per-estate di Settings dengan key: activeProgramId:SRIE, activeProgramId:STWE, dst.
// Fallback: key global activeProgramId (legacy) jika key per-estate belum ada.
function getActiveProgramIdForEstate_(estateCode) {
  const est = String(estateCode || '').trim().toUpperCase();
  if (est) {
    return getSetting_('activeProgramId:' + est) || getSetting_('activeProgramId') || '';
  }
  return getSetting_('activeProgramId') || '';
}

function isAdmin_(sess) {
  const role = String(sess && sess.user && sess.user.role || '').toUpperCase();
  return role === 'ADMIN' || role === 'ADMINISTRATOR';
}

function getEstateCodeFromSession_(sess) {
  return String(sess && sess.user && sess.user.estate || '').trim().toUpperCase();
}

// Resolve estate_code untuk request:
// - default: estate dari user session
// - admin boleh override via parameter estate_code
function resolveEstateCode_(sess, p) {
  const override = String((p && p.estate_code) || '').trim().toUpperCase();
  if (override && isAdmin_(sess)) return override;
  return getEstateCodeFromSession_(sess);
}

// Resolve program context untuk operasi harian:
// - admin boleh override program_id lewat parameter (jika allowProgramOverride=true)
// - selain itu: pakai activeProgramId per-estate
function resolveProgramContext_(sess, p, allowProgramOverride) {
  const requestedProgramId = String((p && p.program_id) || '').trim();

  // ADMIN override: pilih program tertentu ATAU semua program (tanpa filter)
  if (allowProgramOverride && isAdmin_(sess)) {
    if (requestedProgramId === '__ALL__') {
      // program_id kosong => fungsi-fungsi list/dashboard yang pakai `!programId || ...` otomatis jadi "tanpa filter"
      return { program_id: '', estate_code: '' };
    }
    if (requestedProgramId) {
      return { program_id: requestedProgramId, estate_code: resolveEstateCode_(sess, p) };
    }
  }

  // Non-admin (atau admin tanpa override): fallback ke program aktif per-estate user
  const estate = resolveEstateCode_(sess, p);
  const pid = getActiveProgramIdForEstate_(estate);
  if (!pid) throw new Error('activeProgramId belum diset untuk Estate ' + (estate || '(kosong)'));
  return { program_id: pid, estate_code: estate };
}
function getSheet_(sheetKey) {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheetName = (CONFIG.SHEETS && CONFIG.SHEETS[sheetKey]) ? CONFIG.SHEETS[sheetKey] : sheetKey; // fallback
  const sh = ss.getSheetByName(sheetName);
  if (!sh) throw new Error('Sheet not found: ' + sheetName + ' (key: ' + sheetKey + ')');
  return sh;
}
function sheetToObjects_(sheetKey) {
  const sh = getSheet_(sheetKey);
  const values = sh.getDataRange().getValues();
  if (!values || values.length < 2) return [];

  // normalize header → lower-case + trim
  const headers = values[0].map(h => normalizeHeader_(h));
  const out = [];

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = row[j] === undefined ? '' : String(row[j]);
    }
    out.push(obj);
  }
  return out;
}

function getHeaders_(sheetKey) {
  const sh = getSheet_(sheetKey);
  const headers = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(String);
  return headers;
}


/** Ensure required columns exist (adds missing headers to the right). */
function ensureColumns_(sheetKey, requiredHeaders) {
  if (!requiredHeaders || !requiredHeaders.length) return;
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sh = ss.getSheetByName(CONFIG.SHEETS[sheetKey]);
  if (!sh) throw new Error('Sheet not found: ' + sheetKey);
  const lastCol = Math.max(1, sh.getLastColumn());
  const headers = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
  const norm = {};
  headers.forEach(h => norm[normalizeHeader_(h)] = true);
  const toAdd = [];
  requiredHeaders.forEach(h => {
    if (!norm[normalizeHeader_(h)]) toAdd.push(h);
  });
  if (!toAdd.length) return;
  sh.getRange(1, lastCol + 1, 1, toAdd.length).setValues([toAdd]);
}

function normalizeHeader_(h) {
  return String(h === undefined || h === null ? '' : h).trim().toLowerCase();
}

function getValueByHeader_(obj, rawHeader) {
  if (!obj) return '';
  // 1) exact match (kalau caller pakai header asli)
  if (Object.prototype.hasOwnProperty.call(obj, rawHeader)) return obj[rawHeader];
  // 2) normalized match (default)
  const k = normalizeHeader_(rawHeader);
  if (Object.prototype.hasOwnProperty.call(obj, k)) return obj[k];
  // 3) fallback: cari key yang sama setelah normalisasi
  const keys = Object.keys(obj);
  for (let i=0;i<keys.length;i++) {
    if (normalizeHeader_(keys[i]) === k) return obj[keys[i]];
  }
  return '';
}

function findHeaderIndex_(headers, colName) {
  const target = normalizeHeader_(colName);
  for (let i=0;i<headers.length;i++) {
    if (normalizeHeader_(headers[i]) === target) return i;
  }
  return -1;
}

function appendRow_(sheetKey, obj) {
  const sh = getSheet_(sheetKey);
  const headers = getHeaders_(sheetKey);
  const row = headers.map(h => {
    const v = getValueByHeader_(obj, h);
    return v === undefined ? '' : v;
  });
  sh.appendRow(row);
}

function rowToObject_(headers, row) {
  const obj = {};
  // normalize keys
  for (let j=0;j<headers.length;j++) obj[normalizeHeader_(headers[j])] = row[j] === undefined ? '' : String(row[j]);
  return obj;
}

function findRowIndexById_(values, idIdx, idVal) {
  for (let i=1;i<values.length;i++) {
    if (String(values[i][idIdx]||'') === idVal) return i+1; // 1-based row number
  }
  return -1;
}

function writeRowById_(sheetKey, idCol, idVal, obj, merge) {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sh = ss.getSheetByName(CONFIG.SHEETS[sheetKey]);
  const values = sh.getDataRange().getValues();
  const headers = values[0].map(String);
  const idIdx = findHeaderIndex_(headers, idCol);
  if (idIdx < 0) throw new Error('Missing id col ' + idCol + ' in ' + sheetKey);
  const rowNo = findRowIndexById_(values, idIdx, idVal);
  if (rowNo < 2) throw new Error(sheetKey + ' id not found: ' + idVal);

  let cur = rowToObject_(headers, values[rowNo-1]);
  // Pastikan obj juga bisa case-insensitive
  const objNorm = {};
  Object.keys(obj||{}).forEach(k => { objNorm[normalizeHeader_(k)] = obj[k]; });
  const next = merge ? Object.assign({}, cur, objNorm) : objNorm;
  const row = headers.map(h => {
    const key = normalizeHeader_(h);
    if (Object.prototype.hasOwnProperty.call(next, key) && next[key] !== undefined) return next[key];
    return merge ? (cur[key] || '') : '';
  });
  sh.getRange(rowNo, 1, 1, headers.length).setValues([row]);
}

function findById_(sheetKey, idCol, idVal) {
  const key = normalizeHeader_(idCol);
  const target = String(idVal || '');
  const rows = sheetToObjects_(sheetKey);
  return rows.find(x => String(x[key] || '') === target) || null;
}

function getRowById_(sheetKey, idCol, idVal) {
  return findById_(sheetKey, idCol, idVal);
}

// Backward compatible helper: update row by id (merge = true)
function updateById_(sheetKey, idCol, idVal, obj) {
  return writeRowById_(sheetKey, idCol, idVal, obj || {}, true);
}



/** Generate PDF certificate and store to Drive, returns {ok,fileId,url,qrUrl} */

/** Generate PDF certificate and store to Drive, returns {ok,fileId,url,qrUrl} */
function generateCertificatePdf_(cert) {
  try {
    const program = findById_('Programs', 'program_id', cert.program_id) || {};

    // Resolve estate context (multi-estate)
    let estateCode = '';
    try {
      if (String(cert.person_type||'') === 'PESERTA') {
        const pt = findById_('Participants', 'participant_id', cert.person_id) || {};
        estateCode = String(pt.estate||'').trim();
      } else if (String(cert.person_type||'') === 'MENTOR') {
        const mt = findById_('Mentors', 'mentor_id', cert.person_id) || {};
        estateCode = String(mt.estate||'').trim();
      }
    } catch(e) {}

    const appName = getSetting_('appName') || getSetting_('orgName') || 'Sekolah Pemanen';
    const estateName = getSetting_(estateKey_('estateName', estateCode)) || getSetting_('estateName') || getSetting_('orgName') || 'Estate';
    const managerName = getSetting_(estateKey_('managerName', estateCode)) || getSetting_('managerName') || 'Manager';
    const orgName = getSetting_('orgName') || estateName;

    const progName = program.name || program.program_name || 'Program';
    const period = program.period || (program.period_start ? (String(program.period_start||'') + (program.period_end ? (' s/d ' + String(program.period_end||'')) : '')) : '');

    const verifyUrl = buildVerifyUrl_(cert.verify_code);

    // QR image (Google Chart)
    const qrUrl = 'https://chart.googleapis.com/chart?cht=qr&chs=260x260&chld=M|0&chl=' + encodeURIComponent(verifyUrl);
    const qrBlob = UrlFetchApp.fetch(qrUrl).getBlob();
    const qrData = 'data:image/png;base64,' + Utilities.base64Encode(qrBlob.getBytes());

    // Logo (optional)
    let logoData = '';
    const logoFileId = String(getSetting_('companyLogoFileId') || '').trim();
    if (logoFileId) {
      try {
        const lb = DriveApp.getFileById(logoFileId).getBlob();
        const ct = lb.getContentType() || 'image/png';
        logoData = 'data:' + ct + ';base64,' + Utilities.base64Encode(lb.getBytes());
      } catch (e) { logoData = ''; }
    }

    const certTitle = (cert.person_type === 'MENTOR') ? 'SERTIFIKAT MENTOR' : 'SERTIFIKAT KELULUSAN';
    const roleLine = (cert.person_type === 'MENTOR') ? 'Sebagai Mentor' : 'Sebagai Peserta';

    const html = `
<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<style>
  @page { size: A4 landscape; margin: 0; }
  body{ font-family: "Georgia", "Times New Roman", serif; margin:0; padding:0; color:#0b1220; }
  .page{ width: 297mm; height: 210mm; position: relative; }
  .frame{ position:absolute; inset: 14mm; border: 2.2mm solid #0f766e; border-radius: 10mm; padding: 12mm 14mm; box-sizing:border-box; }
  .inner{ position:absolute; inset: 18mm; border: 0.6mm solid #94a3b8; border-radius: 8mm; }
  .header{ display:flex; align-items:center; gap:10mm; }
  .logo{ width:34mm; height:34mm; object-fit:contain; }
  .hgroup{ flex:1; text-align:center; }
  .org{ font-family: Arial, Helvetica, sans-serif; font-size: 12pt; letter-spacing: 0.08em; text-transform: uppercase; color:#0f172a; }
  .app{ font-family: Arial, Helvetica, sans-serif; font-size: 10pt; color:#334155; margin-top:2mm; }
  .title{ text-align:center; margin-top: 10mm; font-size: 28pt; letter-spacing: 0.08em; font-weight:700; }
  .subtitle{ text-align:center; margin-top: 2mm; font-size: 12pt; color:#334155; font-family: Arial, Helvetica, sans-serif; }
  .presented{ text-align:center; margin-top: 10mm; font-size: 12pt; color:#0f172a; font-family: Arial, Helvetica, sans-serif; }
  .name{ text-align:center; margin-top: 3mm; font-size: 30pt; font-weight:700; }
  .meta{ text-align:center; margin-top: 3mm; font-size: 11pt; color:#334155; font-family: Arial, Helvetica, sans-serif; }
  .program{ text-align:center; margin-top: 8mm; font-size: 11pt; color:#0f172a; font-family: Arial, Helvetica, sans-serif; }
  .program b{ font-size: 12pt; }
  .footer{ position:absolute; left: 14mm; right: 14mm; bottom: 14mm; display:flex; align-items:flex-end; justify-content:space-between; }
  .qrbox{ width: 58mm; }
  .qr{ width: 32mm; height: 32mm; }
  .verify{ font-size: 8.8pt; color:#334155; font-family: Arial, Helvetica, sans-serif; margin-top:2mm; word-break:break-all; }
  .certno{ font-size: 10pt; color:#0f172a; font-family: Arial, Helvetica, sans-serif; margin-top:3mm; }
  .signbox{ width: 92mm; text-align:center; font-family: Arial, Helvetica, sans-serif; }
  .place{ font-size: 10pt; color:#334155; }
  .signspace{ height: 16mm; }
  .signline{ border-top: 0.4mm solid #0f172a; margin: 0 10mm; }
  .signname{ margin-top:2mm; font-weight:700; font-size: 11pt; }
  .signrole{ margin-top:1mm; font-size: 10pt; color:#334155; }
  .watermark{ position:absolute; inset: 0; display:flex; align-items:center; justify-content:center; opacity:0.04; font-size: 72pt; font-weight:800; letter-spacing:0.2em; transform: rotate(-12deg); }
</style>
</head>
<body>
  <div class="page">
    <div class="watermark">${escapeHtml_(appName)}</div>
    <div class="frame">
      <div class="inner"></div>
      <div class="header">
        ${logoData ? `<img class="logo" src="${logoData}" alt="logo"/>` : `<div class="logo"></div>`}
        <div class="hgroup">
          <div class="org">${escapeHtml_(orgName)}</div>
          <div class="app">${escapeHtml_(appName)} • ${escapeHtml_(estateName)}</div>
        </div>
        <div style="width:34mm"></div>
      </div>

      <div class="title">${escapeHtml_(certTitle)}</div>
      <div class="subtitle">${escapeHtml_(roleLine)} • ${escapeHtml_(progName)}${period ? (' • ' + escapeHtml_(period)) : ''}</div>

      <div class="presented">Diberikan kepada</div>
      <div class="name">${escapeHtml_(cert.name||'-')}</div>
      <div class="meta">NIK: ${escapeHtml_(cert.nik||'-')} • Tanggal Terbit: ${escapeHtml_(isoToDmy_(cert.issue_date||'-'))}</div>

      <div class="program">Atas partisipasi dan pencapaian dalam <b>${escapeHtml_(progName)}</b></div>

      <div class="footer">
        <div class="qrbox">
          <img class="qr" src="${qrData}" alt="QR"/>
          <div class="verify">Verifikasi: ${escapeHtml_(verifyUrl)}</div>
          <div class="certno">No. Sertifikat: <b>${escapeHtml_(cert.certificate_no||'-')}</b></div>
        </div>

        <div class="signbox">
          <div class="place">${escapeHtml_(estateName)}, ${escapeHtml_(isoToDmy_(cert.issue_date||''))}</div>
          <div class="signspace"></div>
          <div class="signline"></div>
          <div class="signname">${escapeHtml_(managerName)}</div>
          <div class="signrole">Manager</div>
        </div>
      </div>

    </div>
  </div>
</body>
</html>
`;

    const blob = HtmlService.createHtmlOutput(html).getBlob().setName('Sertifikat-' + cert.certificate_no + '.html');
    const pdfBlob = blob.getAs('application/pdf').setName('Sertifikat-' + cert.certificate_no + '.pdf');

    let folderId = getSetting_('certFolderId') || CONFIG.CERT_FOLDER_ID || '';
    let file;
    if (folderId) {
      const folder = DriveApp.getFolderById(folderId);
      file = folder.createFile(pdfBlob);
    } else {
      file = DriveApp.createFile(pdfBlob);
    }
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    return { ok:true, fileId:file.getId(), url:file.getUrl(), qrUrl: qrUrl };
  } catch (err) {
    return { ok:false, error:String(err) };
  }
}


/** Verification endpoint for certificates */

function verifyCert_(p) {
  const code = String(p.code||'').trim();
  if (!code) return { ok:false, error:'code wajib' };

  const cert = sheetToObjects_('Certificates').find(x => String(x.verify_code||'') === code || String(x.certificate_no||'') === code);
  if (!cert) return { ok:false, error:'Sertifikat tidak ditemukan' };

  const program = findById_('Programs', 'program_id', cert.program_id) || {};

  // Resolve estate context (multi-estate)
  let estateCode = '';
  try {
    if (String(cert.person_type||'') === 'PESERTA') {
      const pt = findById_('Participants', 'participant_id', cert.person_id) || {};
      estateCode = String(pt.estate||'').trim();
    } else if (String(cert.person_type||'') === 'MENTOR') {
      const mt = findById_('Mentors', 'mentor_id', cert.person_id) || {};
      estateCode = String(mt.estate||'').trim();
    }
  } catch(e) {}

  const appName = getSetting_('appName') || getSetting_('orgName') || 'Sekolah Pemanen';
  const estateName = getSetting_(estateKey_('estateName', estateCode)) || getSetting_('estateName') || getSetting_('orgName') || 'Estate';
  const orgName = getSetting_('orgName') || estateName;

  // logo embed (optional)
  let logoData = '';
  const logoFileId = String(getSetting_('companyLogoFileId') || '').trim();
  if (logoFileId) {
    try {
      const lb = DriveApp.getFileById(logoFileId).getBlob();
      const ct = lb.getContentType() || 'image/png';
      logoData = 'data:' + ct + ';base64,' + Utilities.base64Encode(lb.getBytes());
    } catch (e) { logoData = ''; }
  }

  const payload = {
    ok:true,
    certificate_no: cert.certificate_no || '',
    verify_code: cert.verify_code || '',
    person_type: cert.person_type || '',
    nik: cert.nik || '',
    name: cert.name || '',
    issue_date: cert.issue_date || '',
    program: program.name || program.program_name || '',
    period: program.period || '',
    pdf_url: cert.pdf_url || ''
  };

  const html = `
<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Verifikasi Sertifikat</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>tailwind.config={darkMode:'class'};</script>
</head>
<body class="min-h-screen bg-slate-50 text-slate-900">
  <div class="max-w-3xl mx-auto p-5">
    <div class="flex items-center gap-3">
      <div class="w-12 h-12 rounded-2xl bg-emerald-600/10 flex items-center justify-center overflow-hidden">
        ${logoData ? `<img src="${logoData}" class="w-full h-full object-contain" alt="logo"/>` : `<span class="text-2xl">🌴</span>`}
      </div>
      <div class="min-w-0">
        <div class="font-semibold leading-tight">${escapeHtml_(orgName)}</div>
        <div class="text-sm text-slate-500">${escapeHtml_(appName)} • ${escapeHtml_(estateName)}</div>
      </div>
    </div>

    <div class="mt-6 rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div class="p-6">
        <div class="flex items-start justify-between gap-4">
          <div>
            <div class="text-xl font-semibold">Verifikasi Sertifikat</div>
            <div class="text-sm text-slate-500 mt-1">Kode verifikasi: <span class="font-mono">${escapeHtml_(payload.verify_code)}</span></div>
          </div>
          <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-600/10 text-emerald-700 text-sm font-medium">
            <span class="w-2 h-2 rounded-full bg-emerald-600"></span>
            VALID
          </div>
        </div>

        <div class="mt-5 grid sm:grid-cols-2 gap-4">
          <div class="rounded-2xl bg-slate-50 p-4">
            <div class="text-xs text-slate-500">No. Sertifikat</div>
            <div class="text-lg font-semibold mt-1">${escapeHtml_(payload.certificate_no)}</div>
          </div>
          <div class="rounded-2xl bg-slate-50 p-4">
            <div class="text-xs text-slate-500">Tanggal Terbit</div>
            <div class="text-lg font-semibold mt-1">${escapeHtml_(isoToDmy_(payload.issue_date))}</div>
          </div>
          <div class="rounded-2xl bg-slate-50 p-4">
            <div class="text-xs text-slate-500">Nama</div>
            <div class="text-base font-semibold mt-1">${escapeHtml_(payload.name)}</div>
            <div class="text-sm text-slate-500 mt-1">NIK: ${escapeHtml_(payload.nik)}</div>
          </div>
          <div class="rounded-2xl bg-slate-50 p-4">
            <div class="text-xs text-slate-500">Program</div>
            <div class="text-base font-semibold mt-1">${escapeHtml_(payload.program)}</div>
            <div class="text-sm text-slate-500 mt-1">${payload.period ? escapeHtml_(payload.period) : ''}</div>
          </div>
        </div>

        <div class="mt-4 rounded-2xl border border-slate-200 p-4">
          <div class="text-xs text-slate-500">Tipe Sertifikat</div>
          <div class="text-base font-semibold mt-1">${escapeHtml_(payload.person_type)}</div>
        </div>

        ${payload.pdf_url ? `
        <div class="mt-5">
          <a href="${payload.pdf_url}" target="_blank" rel="noopener" class="inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 bg-emerald-600 text-white hover:bg-emerald-700 w-full sm:w-auto">
            <span>📄</span>
            <span>Buka PDF Sertifikat</span>
          </a>
          <div class="text-xs text-slate-500 mt-2">Jika tombol tidak bisa dibuka, salin link PDF dari kolom Certificates.</div>
        </div>
        ` : ''}
      </div>
      <div class="px-6 py-4 bg-slate-50 text-xs text-slate-500">
        Halaman ini dibuat otomatis oleh sistem. Pastikan URL berasal dari domain Google Apps Script.
      </div>
    </div>

    <div class="mt-6 text-center text-xs text-slate-500">© ${escapeHtml_(orgName)} • ${escapeHtml_(appName)}</div>
  </div>
</body>
</html>
`;

  return { json: payload, html: html };
}


function buildVerifyUrl_(verifyCode) {
  const base = ScriptApp.getService().getUrl();
  return base + '?action=verifyCert&code=' + encodeURIComponent(verifyCode) + '&format=html';
}

function randomCode_(len) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789abcdefghijkmnpqrstuvwxyz';
  let out = '';
  for (let i=0;i<len;i++) out += chars[Math.floor(Math.random()*chars.length)];
  return out;
}

function escapeHtml_(s) {
  s = String(s||'');
  return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}



function lookupParticipants_(sess, p) {
  const ctx = resolveProgramContext_(sess, p || {}, true);
  const activeProgramId = ctx.program_id;
  if (!activeProgramId) return { ok:false, error:'activeProgramId belum diset' };

  const q = String(p.q||'').trim().toLowerCase();
  const category = String(p.category||'').trim(); // optional

  // role mentor -> hanya mentee yang sedang ACTIVE pairing
  let allowedIds = null;
  if (String(sess.user.role||'').toUpperCase() === 'MENTOR') {
    const myMentor = sheetToObjects_('Mentors').find(m => String(m.nik||'') === String(sess.user.nik||''));
    const myMentorId = myMentor ? String(myMentor.mentor_id||'').trim() : '';
    const pairs = sheetToObjects_('Pairings').filter(x =>
      String(x.program_id||'')===activeProgramId &&
      String(x.status||'')==='ACTIVE' &&
      String(x.mentor_id||'')===myMentorId
    );
    allowedIds = new Set(pairs.map(x => String(x.participant_id||'')));
  }

  const parts = sheetToObjects_('Participants')
    .filter(x => String(x.program_id||'')===activeProgramId)
    .filter(x => !allowedIds || allowedIds.has(String(x.participant_id||'')))
    .filter(x => !category || String(x.category||'')===category)
    .filter(x => !q || String(x.name||'').toLowerCase().includes(q) || String(x.nik||'').toLowerCase().includes(q));

  const items = parts.slice(0, 200).map(x => ({
    participant_id: x.participant_id,
    nik: x.nik || '',
    name: x.name || '',
    category: x.category || '',
    status: x.status || '',
    mentor_id: x.mentor_id || ''
  }));
  return { ok:true, items };
}


function lookupMentors_(sess, p) {
  const ctx = resolveProgramContext_(sess, p || {}, true);
  const activeProgramId = ctx.program_id;

  const q = String(p.q||'').trim().toLowerCase();

  ensureColumns_('Mentors', ['program_id','estate','divisi','updated_at']);

  const ms = sheetToObjects_('Mentors')
    .filter(x => !activeProgramId || String(x.program_id||'') === String(activeProgramId))
    .filter(x => !q || String(x.name||'').toLowerCase().includes(q) || String(x.nik||'').toLowerCase().includes(q));

  const items = ms.slice(0, 200).map(x => ({
    mentor_id: x.mentor_id,
    nik: x.nik || '',
    name: x.name || '',
    estate: x.estate || '',
    divisi: x.divisi || '',
    active: x.active || ''
  }));

  return { ok:true, items };
}

function getParticipantMentor_(sess, p) {
  const ctx = resolveProgramContext_(sess, p || {}, true);
  const activeProgramId = ctx.program_id;
  if (!activeProgramId) return { ok:false, error:'activeProgramId belum diset' };
  const participant_id = String(p.participant_id||'').trim();
  if (!participant_id) return { ok:false, error:'participant_id wajib' };

  const pair = sheetToObjects_('Pairings').find(x =>
    String(x.program_id||'')===activeProgramId &&
    String(x.participant_id||'')===participant_id &&
    String(x.status||'')==='ACTIVE'
  );
  if (!pair) return { ok:true, mentor:null };

  const m = findById_('Mentors', 'mentor_id', String(pair.mentor_id||'')) || {};
  return { ok:true, mentor: { mentor_id: String(pair.mentor_id||''), nik: m.nik||'', name: m.name||'' } };
}

function getSettingNumber_(key, defVal){
  const v = String(getSetting_(key)||'').trim();
  const n = Number(v);
  return isFinite(n) && n>0 ? n : defVal;
}

// -------------------- Settings & Users --------------------
function estateKey_(baseKey, estateCode) {
  const e = String(estateCode||'').trim();
  if (!e) return String(baseKey||'');
  return String(baseKey||'') + ':' + e;
}

function resolveEstateSetting_(map, baseKey, estateCode) {
  const k = estateKey_(baseKey, estateCode);
  return (map[k] !== undefined && map[k] !== null && String(map[k]) !== '')
    ? String(map[k])
    : (map[baseKey] !== undefined ? String(map[baseKey]) : '');
}

function listEstateCodes_() {
  // Sumber utama: MasterEstates (lebih rapi untuk governance).
  // Fallback: ambil dari Users bila sheet MasterEstates belum ada.
  try {
    const estates = sheetToObjects_('MasterEstates');
    const set = {};
    estates.forEach(r => {
      const code = String(r.estate_code || r.estate || r.code || '').trim();
      const active = String(r.active || 'TRUE').toUpperCase() !== 'FALSE';
      if (code && active) set[code] = true;
    });
    const out = Object.keys(set).sort();
    if (out.length) return out;
  } catch (e) {
    // ignore
  }
  try {
    const users = sheetToObjects_('Users');
    const set = {};
    users.forEach(u => {
      const e = String(u.estate||'').trim();
      if (e) set[e] = true;
    });
    return Object.keys(set).sort();
  } catch (e) {
    return [];
  }
}

function ensureMasterEstatesSheet_() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  let sh = ss.getSheetByName(CONFIG.SHEETS.MasterEstates);
  if (!sh) {
    sh = ss.insertSheet(CONFIG.SHEETS.MasterEstates);
    sh.getRange(1,1,1,6).setValues([[
      'estate_code','estate_name','manager_name','logo_file_id','active','updated_at'
    ]]);
  }
  return sh;
}

function getMasterEstateByCode_(estateCode) {
  if (!estateCode) return null;
  try {
    const rows = sheetToObjects_('MasterEstates');
    const code = String(estateCode).trim();
    return rows.find(r => String(r.estate_code || r.estate || r.code || '').trim() === code) || null;
  } catch (e) {
    return null;
  }
}

function upsertMasterEstate_(estateCode, updates) {
  const code = String(estateCode||'').trim();
  if (!code) throw new Error('estateCode wajib');
  const sh = ensureMasterEstatesSheet_();
  const values = sh.getDataRange().getValues();
  const headersRaw = values[0] || [];
  const headers = headersRaw.map(h => normalizeHeader_(h));
  const idxCode = headers.indexOf('estate_code') >= 0 ? headers.indexOf('estate_code') : headers.indexOf('estate');
  if (idxCode < 0) throw new Error('Header estate_code tidak ditemukan di MasterEstates');

  const rowMap = {};
  Object.keys(updates||{}).forEach(k => { rowMap[normalizeHeader_(k)] = updates[k]; });

  // cari row
  let rowIndex = -1; // 0-based in values
  for (let i=1;i<values.length;i++) {
    const v = String(values[i][idxCode]||'').trim();
    if (v === code) { rowIndex = i; break; }
  }

  // jika belum ada, append
  if (rowIndex < 0) {
    const newRow = new Array(headers.length).fill('');
    newRow[idxCode] = code;
    // default active TRUE
    const idxActive = headers.indexOf('active');
    if (idxActive >= 0) newRow[idxActive] = 'TRUE';
    values.push(newRow);
    rowIndex = values.length - 1;
  }

  // apply updates ke array row
  const row = values[rowIndex];
  headers.forEach((hk, j) => {
    if (hk in rowMap) row[j] = String(rowMap[hk]);
  });
  // updated_at
  const idxUpd = headers.indexOf('updated_at');
  if (idxUpd >= 0) row[idxUpd] = nowIso_();

  // write back only that row
  sh.getRange(rowIndex+1, 1, 1, headers.length).setValues([row]);
  return { ok:true };
}



// -------------------- MasterEstates (CRUD) --------------------
function listMasterEstates_(sess){
  if (!inRoles_(sess, ['ADMIN'])) return { ok:false, error:'Hanya ADMIN' };
  const items = sheetToObjects_('MasterEstates').map(r => ({
    estate_code: String(r.estate_code || r.estate || r.code || '').trim().toUpperCase(),
    estate_name: String(r.estate_name || '').trim(),
    manager_name: String(r.manager_name || '').trim(),
    logo_file_id: String(r.logo_file_id || '').trim(),
    active: String(r.active || 'TRUE').toUpperCase() !== 'FALSE',
    updated_at: String(r.updated_at || '').trim()
  }));
  return { ok:true, items: items.filter(x=>x.estate_code).sort((a,b)=>a.estate_code.localeCompare(b.estate_code)) };
}

function upsertMasterEstateAction_(sess, p){
  if (!inRoles_(sess, ['ADMIN'])) return { ok:false, error:'Hanya ADMIN' };
  const estate_code = String(p.estate_code||p.estate||'').trim().toUpperCase();
  if (!estate_code) return { ok:false, error:'estate_code wajib' };

  const updates = {
    estate_name: String(p.estate_name||'').trim(),
    manager_name: String(p.manager_name||'').trim(),
    active: String(p.active||'TRUE').toUpperCase() === 'FALSE' ? 'FALSE' : 'TRUE'
  };
  if (p.logo_file_id) updates.logo_file_id = String(p.logo_file_id).trim();

  upsertMasterEstate_(estate_code, updates);
  audit_(sess.user.nik,'UPSERT_MASTER_ESTATE','MasterEstates',estate_code,updates);
  return { ok:true };
}

function deleteMasterEstate_(sess, p){
  if (!inRoles_(sess, ['ADMIN'])) return { ok:false, error:'Hanya ADMIN' };
  const estate_code = String(p.estate_code||p.estate||'').trim().toUpperCase();
  if (!estate_code) return { ok:false, error:'estate_code wajib' };

  const sh = ensureMasterEstatesSheet_();
  const values = sh.getDataRange().getValues();
  const headers = (values[0]||[]).map(h => normalizeHeader_(h));
  const idxCode = headers.indexOf('estate_code') >= 0 ? headers.indexOf('estate_code') : headers.indexOf('estate');
  if (idxCode < 0) return { ok:false, error:'Header estate_code tidak ditemukan' };

  let rowIndex = -1;
  for (let i=1;i<values.length;i++){
    if (String(values[i][idxCode]||'').trim().toUpperCase() === estate_code){
      rowIndex = i; break;
    }
  }
  if (rowIndex < 0) return { ok:false, error:'Estate tidak ditemukan' };
  sh.deleteRow(rowIndex+1);
  audit_(sess.user.nik,'DELETE_MASTER_ESTATE','MasterEstates',estate_code,{});
  return { ok:true };
}


function getSettings_(sess, p) {
  const all = sheetToObjects_('Settings');
  const map = {};
  all.forEach(r => { map[String(r.key||'').trim()] = String(r.value||''); });

  const estates = listEstateCodes_();
  const requestedEstate = String((p && p.estate) ? p.estate : '').trim().toUpperCase();
  const myEstate = String(sess && sess.user && sess.user.estate ? sess.user.estate : '').trim().toUpperCase();
  const estateCode = inRoles_(sess, ['ADMIN']) ? (requestedEstate || myEstate || estates[0] || '') : myEstate;

  const appName = map.appName || map.appTitle || map.orgName || 'Sekolah Pemanen';

  const me = getMasterEstateByCode_(estateCode) || {};
  const estateName = String(me.estate_name || '').trim() || resolveEstateSetting_(map, 'estateName', estateCode);
  const managerName = String(me.manager_name || '').trim() || resolveEstateSetting_(map, 'managerName', estateCode);

  const companyLogoFileId = String(map.companyLogoFileId || '').trim();
  const companyLogoUrl = companyLogoFileId ? ('https://drive.google.com/uc?id=' + companyLogoFileId) : '';

  if (!inRoles_(sess, ['ADMIN'])) {
    return { ok:true, settings: {
      appName,
      orgName: map.orgName || '',
      estateCode,
      estateName,
      managerName,
      companyLogoFileId,
      companyLogoUrl,
      estateOptions: estates
    }};
  }

  const out = Object.assign({}, map, {
    estateCode,
    estateName,
    managerName,
    companyLogoFileId,
    companyLogoUrl,
    estateOptions: estates,
    masterEstates: sheetToObjects_('MasterEstates')
      .map(r => ({
        estate_code: String(r.estate_code || r.estate || r.code || '').trim().toUpperCase(),
        estate_name: String(r.estate_name || '').trim(),
        manager_name: String(r.manager_name || '').trim(),
        logo_file_id: String(r.logo_file_id || '').trim(),
        active: String(r.active || 'TRUE').toUpperCase() !== 'FALSE',
        updated_at: String(r.updated_at || '').trim()
      }))
      .filter(x=>x.estate_code)
      .sort((a,b)=>a.estate_code.localeCompare(b.estate_code))
  });
  return { ok:true, settings: out };
}

function setSettings_(sess, p) {
  if (!inRoles_(sess, ['ADMIN'])) return { ok:false, error:'Hanya ADMIN' };
  const estateCode = String(p.estate||'').trim();
  const itemsJson = p.items_json || '';
  let items = null;
  if (itemsJson) {
    try { items = JSON.parse(itemsJson); } catch (e) { return { ok:false, error:'items_json tidak valid' }; }
  } else {
    // single
    items = [{ key: String(p.key||'').trim(), value: String(p.value||'') }];
  }
  if (!Array.isArray(items) || !items.length) return { ok:false, error:'Tidak ada item' };

  const perEstateKeys = { estateName:true, managerName:true };

  items.forEach(it => {
    const key0 = String(it.key||'').trim();
    if (!key0) return;
    const val = String(it.value||'');

    if (perEstateKeys[key0]) {
      if (!estateCode) throw new Error('Parameter estate wajib untuk mengubah ' + key0);
      // Tulis ke MasterEstates (governance)
      const updates = {};
      if (key0 === 'estateName') updates.estate_name = val;
      if (key0 === 'managerName') updates.manager_name = val;
      upsertMasterEstate_(estateCode, updates);
      // Simpan juga ke Settings (legacy) agar kompatibel dengan data lama (optional)
      upsertSetting_(estateKey_(key0, estateCode), val);
      return;
    }

    // global settings tetap ke Settings
    upsertSetting_(key0, val);
  });

  audit_(sess.user.nik, 'SETTINGS_UPDATE', 'Settings', '', { keys: items.map(x=>x.key), estate: estateCode || '' });
  return { ok:true };
}

function upsertSetting_(key, value) {
  const sh = getSheet_('Settings');
  const headers = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(String);
  const keyCol = headers.indexOf('key') + 1;
  const valCol = headers.indexOf('value') + 1;
  if (keyCol < 1 || valCol < 1) throw new Error('Settings headers wajib: key,value');

  const last = sh.getLastRow();
  if (last < 2) {
    sh.appendRow([key, value]);
    return;
  }
  const keys = sh.getRange(2, keyCol, last-1, 1).getValues().map(r => String(r[0]||''));
  const idx = keys.findIndex(x => x === key);
  if (idx >= 0) {
    sh.getRange(2+idx, valCol).setValue(value);
  } else {
    sh.appendRow([key, value]);
  }
}

function listUsers_(sess) {
  if (!inRoles_(sess, ['ADMIN'])) return { ok:false, error:'Hanya ADMIN' };
  const items = sheetToObjects_('Users').map(u => {
    const out = Object.assign({}, u);
    // hide pin on list
    if (out.pin) out.pin = '';
    return out;
  });
  return { ok:true, items };
}

function upsertUser_(sess, p) {
  if (!inRoles_(sess, ['ADMIN'])) return { ok:false, error:'Hanya ADMIN' };

  // ✅ Pastikan Users minimal punya kolom divisi (sesuai header Bapak)
  ensureColumns_('Users', ['user_id','nik','name','role','estate','divisi','active','pin','created_at','updated_at']);

  const nik = String(p.nik||'').trim();
  const name = String(p.name||'').trim();
  const role = String(p.role||'').trim() || 'MANDOR';
  const estate = String(p.estate||'').trim().toUpperCase();
  const divisi = String(p.divisi||'').trim();
  const active = String(p.active||'TRUE').trim() || 'TRUE';
  const pin = String(p.pin||'').trim();

  if (!nik || !name) return { ok:false, error:'nik & name wajib' };

  const users = sheetToObjects_('Users');
  const existing = users.find(x => String(x.nik||'') === nik) || null;
  const user_id = existing ? String(existing.user_id||'') : (String(p.user_id||'').trim() || Utilities.getUuid());

  const row = {
    user_id,
    nik,
    name,
    role,
    estate,
    // ✅ FIX: simpan ke kolom divisi
    divisi,
    active: active.toUpperCase()==='FALSE' ? 'FALSE' : 'TRUE',
    pin: pin || (existing ? (existing.pin||'') : '1234'),
    updated_at: nowIso_()
  };
  if (!existing) row.created_at = nowIso_();

  if (existing) {
    writeRowById_('Users','user_id',user_id,row,true);
    audit_(sess.user.nik, 'USER_UPDATE', 'Users', user_id, { nik, role, active: row.active });
    return { ok:true, user_id };
  }

  appendRow_('Users', row);
  audit_(sess.user.nik, 'USER_CREATE', 'Users', user_id, { nik, role, active: row.active });
  return { ok:true, user_id };
}

function deleteUser_(sess, p) {
  if (!inRoles_(sess, ['ADMIN'])) return { ok:false, error:'Hanya ADMIN' };
  const user_id = String(p.user_id||'').trim();
  if (!user_id) return { ok:false, error:'user_id wajib' };
  const sh = getSheet_('Users');
  const headers = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(String);
  const idCol = headers.indexOf('user_id')+1;
  if (idCol<1) throw new Error('Users harus punya kolom user_id');
  const last = sh.getLastRow();
  const ids = sh.getRange(2,idCol,last-1,1).getValues().map(r=>String(r[0]||''));
  const idx = ids.findIndex(x=>x===user_id);
  if (idx<0) return { ok:false, error:'User tidak ditemukan' };
  sh.deleteRow(2+idx);
  audit_(sess.user.nik,'USER_DELETE','Users',user_id,{});
  return { ok:true };
}

function resetUserPin_(sess, p) {
  if (!inRoles_(sess, ['ADMIN'])) return { ok:false, error:'Hanya ADMIN' };
  const user_id = String(p.user_id||'').trim();
  const newPin = String(p.new_pin||'1234').trim();
  if (!user_id) return { ok:false, error:'user_id wajib' };
  writeRowById_('Users','user_id',user_id,{ pin:newPin, updated_at: nowIso_() }, true);
  audit_(sess.user.nik,'USER_RESET_PIN','Users',user_id,{});
  return { ok:true };
}

function changeMyPin_(sess, p) {
  const oldPin = String(p.old_pin||'').trim();
  const newPin = String(p.new_pin||'').trim();
  if (!oldPin || !newPin) return { ok:false, error:'old_pin & new_pin wajib' };

  const users = sheetToObjects_('Users');
  const me = users.find(x => String(x.nik||'') === String(sess.user.nik||''));
  if (!me) return { ok:false, error:'User tidak ditemukan' };
  if (String(me.pin||'') !== oldPin) return { ok:false, error:'PIN lama salah' };
  if (newPin.length < 4) return { ok:false, error:'PIN baru minimal 4 digit' };

  writeRowById_('Users','user_id',String(me.user_id||''),{ pin:newPin, updated_at: nowIso_() }, true);
  audit_(sess.user.nik,'CHANGE_PIN','Users',String(me.user_id||''),{});
  return { ok:true };
}

function uploadLogo_(sess, p) {
  if (!inRoles_(sess, ['ADMIN'])) return { ok:false, error:'Hanya ADMIN' };

  const dataUrl = String(p.data_url||p.dataUrl||'').trim();
  const fileName = String(p.file_name||p.fileName||'company_logo.png').trim() || 'company_logo.png';
  if (!dataUrl || !dataUrl.startsWith('data:')) return { ok:false, error:'data_url wajib (data:image/...;base64,...)' };

  const m = dataUrl.match(/^data:([^;]+);base64,(.*)$/);
  if (!m) return { ok:false, error:'data_url format tidak valid' };
  const ct = m[1];
  const b64 = m[2];
  const bytes = Utilities.base64Decode(b64);
  const blob = Utilities.newBlob(bytes, ct, fileName);

  const folderId = String(getSetting_('logoFolderId') || CONFIG.LOGO_FOLDER_ID || '').trim();
  let file;
  if (folderId) file = DriveApp.getFolderById(folderId).createFile(blob);
  else file = DriveApp.createFile(blob);

  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  upsertSetting_('companyLogoFileId', file.getId());

  audit_(sess.user.nik,'UPLOAD_COMPANY_LOGO','Settings',file.getId(),{ fileName });
  return { ok:true, fileId:file.getId(), url:file.getUrl() };
}

/**
 * Upload dokumen kandidat (base64) ke folder Drive khusus, lalu update field di sheet Candidates.
 * Payload (POST JSON):
 *  - candidate_id (wajib)
 *  - field: docs_ktp | docs_kk | docs_skck | docs_health | photo_url (wajib)
 *  - filename, mimeType, base64 (wajib)
 */
function uploadCandidateDoc_(sess, p) {
  if (!inRoles_(sess, ['ADMIN'])) return { ok:false, error:'Hanya ADMIN' };

  const candidate_id = String(p.candidate_id||'').trim();
  const field = String(p.field||'').trim();
  const filename = String(p.filename||'file').trim() || 'file';
  const mimeType = String(p.mimeType||'application/octet-stream').trim() || 'application/octet-stream';
  const b64 = String(p.base64||'').trim();

  if (!candidate_id) return { ok:false, error:'candidate_id wajib' };
  const allowed = { docs_ktp:1, docs_kk:1, docs_skck:1, docs_health:1, photo_url:1 };
  if (!allowed[field]) return { ok:false, error:'field tidak valid' };
  if (!b64) return { ok:false, error:'base64 kosong' };

  // Ensure columns exist
  ensureColumns_('Candidates', [
    'program_id','estate','divisi','family_id','relation',
    'docs_ktp','docs_kk','docs_skck','docs_health','photo_url',
    'updated_at'
  ]);

  const bytes = Utilities.base64Decode(b64);
  const blob = Utilities.newBlob(bytes, mimeType, filename);

  const folderId = String(CONFIG.CANDIDATE_DOCS_FOLDER_ID||'').trim();
  if (!folderId) return { ok:false, error:'Folder dokumen kandidat belum diset' };
  const folder = DriveApp.getFolderById(folderId);

  // Penamaan file lebih jelas
  let safeName = filename;
  try {
    const cand = findById_('Candidates', 'candidate_id', candidate_id) || {};
    const nik = String(cand.nik||'').trim();
    const nm = String(cand.name||'').trim().replace(/[^a-zA-Z0-9 _-]/g,'').slice(0,40);
    safeName = [nik||candidate_id.slice(0,8), nm||'candidate', field, nowCompact_()].filter(Boolean).join('_') + extFromMime_(mimeType, filename);
  } catch (e) {}

  const file = folder.createFile(blob.setName(safeName));
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  const upd = {};
  upd[field] = file.getId();
  upd.updated_at = nowIso_();
  writeRowById_('Candidates', 'candidate_id', candidate_id, upd, true);

  audit_(sess.user.nik, 'UPLOAD_CANDIDATE_DOC', 'Candidates', candidate_id, { field, fileId:file.getId(), filename:safeName });
  return { ok:true, candidate_id, field, file_id:file.getId(), url:file.getUrl() };
}

function nowCompact_() {
  const d = new Date();
  const tz = Session.getScriptTimeZone();
  return Utilities.formatDate(d, tz, 'yyyyMMdd_HHmmss');
}

function extFromMime_(mimeType, filename) {
  const fn = String(filename||'');
  const m = fn.match(/(\.[a-zA-Z0-9]{2,5})$/);
  if (m) return m[1];
  const map = {
    'image/jpeg':'.jpg','image/jpg':'.jpg','image/png':'.png','image/webp':'.webp','application/pdf':'.pdf'
  };
  return map[String(mimeType||'').toLowerCase()] || '';
}

// -------------------- Dashboard Details --------------------
function dashboardDetail_(sess, p) {
  const type = String(p.type||'').trim();
  const ctx = resolveProgramContext_(sess, p || {}, true);
  const activeProgramId = ctx.program_id;
  const requestedProgramId = String((p && p.program_id) ? p.program_id : '').trim();
  const programId = requestedProgramId || activeProgramId;
  if (!type) return { ok:false, error:'type wajib' };

  if (type === 'candidates') {
    if (!isAdmin_(sess)) return { ok:true, items: [] };
    const rows = sheetToObjects_('Candidates').slice(-200).reverse();
    return { ok:true, items: rows };
  }

  if (type === 'participants') {
    const rowsAll = sheetToObjects_('Participants')
      .filter(x => !programId || String(x.program_id||'')===programId)
      .slice(-300).reverse();
    const rows = isAdmin_(sess) ? rowsAll : rowsAll.filter(x => scopeMatchesEstateDivisi_(sess, x.estate, x.divisi));
    return { ok:true, items: rows };
  }

  if (type === 'mentors') {
    const rowsAll = sheetToObjects_('Mentors').slice(-300).reverse();
    const rows = isAdmin_(sess) ? rowsAll : rowsAll.filter(x => scopeMatchesEstateDivisi_(sess, x.estate, x.divisi));
    return { ok:true, items: rows };
  }

  if (type === 'alerts') {
    const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
    const partsAll = sheetToObjects_('Participants').filter(x => !programId || String(x.program_id||'')===programId);
    const parts = isAdmin_(sess) ? partsAll : partsAll.filter(x => scopeMatchesEstateDivisi_(sess, x.estate, x.divisi));

    const logsTodayAll = sheetToObjects_('DailyLogs')
      .filter(x => String(x.date||'')===today)
      .filter(x => !programId || String(x.program_id||'')===programId);

    const visibleIds = new Set(parts.map(p=>String(p.participant_id||'')));
    const logsToday = isAdmin_(sess) ? logsTodayAll : logsTodayAll.filter(l => visibleIds.has(String(l.participant_id||'')));
    const logged = new Set(logsToday.map(x => String(x.participant_id||'')));

    const miss = parts.filter(p => !logged.has(String(p.participant_id||''))).map(x=>({
      participant_id: x.participant_id,
      nik: x.nik||'',
      name: x.name||'',
      category: x.category||'',
      estate: x.estate||'',
      divisi: x.divisi||''
    }));
    return { ok:true, items: miss };
  }

  return { ok:false, error:'type tidak dikenal' };
}

// -------------------- Certificate regenerate --------------------
function regenerateCertificatePdf_(sess, p) {
  if (!inRoles_(sess, ['ADMIN'])) return { ok:false, error:'Hanya ADMIN' };
  ensureCertificatesColumns_();
  const cert_id = String(p.cert_id||'').trim();
  if (!cert_id) return { ok:false, error:'cert_id wajib' };

  const cert = findById_('Certificates','cert_id',cert_id);
  if (!cert) return { ok:false, error:'Sertifikat tidak ditemukan' };

  // Re-generate
  const pdfRes = generateCertificatePdf_(cert);
  if (!pdfRes || !pdfRes.ok) return { ok:false, error: (pdfRes && pdfRes.error) ? pdfRes.error : 'Gagal generate PDF' };

  writeRowById_('Certificates','cert_id',cert_id,{
    drive_file_id: pdfRes.fileId || '',
    pdf_url: pdfRes.url || '',
    qr_url: pdfRes.qrUrl || '',
    updated_at: nowIso_()
  }, true);

  audit_(sess.user.nik,'CERT_REGENERATE','Certificates',cert_id,{ certificate_no: cert.certificate_no });
  return { ok:true, pdf_url: pdfRes.url || '' };
}

function checkDriveAccess_(sess, p) {
  if (!inRoles_(sess, ['ADMIN'])) return { ok:false, error:'Hanya ADMIN' };

  // Bisa override via query param kalau perlu (optional)
  const certId = String(p.certFolderId || CONFIG.CERT_FOLDER_ID || '').trim();
  const logoId = String(p.logoFolderId || CONFIG.LOGO_FOLDER_ID || '').trim();
  const docsId = String(p.docsFolderId || CONFIG.DOCS_FOLDER_ID || CONFIG.CANDIDATE_DOCS_FOLDER_ID || '').trim();

  const res = {
    ok: true,
    ts: nowIso_(),
    folders: {
      cert: folderAccessProbe_(certId, 'sertifikat'),
      logo: folderAccessProbe_(logoId, 'logo'),
      docs: folderAccessProbe_(docsId, 'dokumen')
    }
  };

  // kalau ada salah satu error, ok=false supaya jelas di UI/Frontend
  if (!res.folders.cert.ok || !res.folders.logo.ok || !res.folders.docs.ok) res.ok = false;

  return res;
}

function folderAccessProbe_(folderId, label) {
  const out = {
    label: label,
    folder_id: folderId || '',
    ok: false
  };

  if (!folderId) {
    out.error = 'folder_id kosong';
    return out;
  }

  try {
    const folder = DriveApp.getFolderById(folderId);

    // Probe minimal untuk memastikan benar-benar bisa akses:
    // - getName()
    // - getUrl()
    // - list file 1 langkah (hasNext) => sering memicu error kalau tidak punya izin
    const name = folder.getName();
    const url = folder.getUrl();

    let canList = false;
    try {
      const it = folder.getFiles();
      canList = it.hasNext() || true; // tetap true kalau bisa akses iterator
    } catch (eList) {
      canList = false;
    }

    out.ok = true;
    out.name = name;
    out.url = url;
    out.can_list_files = !!canList;
    return out;

  } catch (err) {
    out.ok = false;
    out.error = String(err && err.message ? err.message : err);
    return out;
  }
}

