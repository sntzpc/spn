import { CONFIG } from './config.js';
import { callApi, callApiPost } from './api.js';
import { toast, btnBusy, h, formatDateISO, formatDateLongID, formatDateDMYID, isoToDMY, dmyToISO, todayDMY } from './ui.js';
import { offlineInit, cacheReplace, cacheGetAll, cacheGetAllRaw, cacheUpsert, cacheDelete, cacheMeta, outboxList, outboxRemove, callOrQueue } from './offline.js';

const $app = document.getElementById('app');

function applyThemeFromStorage() {
  const t = localStorage.getItem(CONFIG.THEME_KEY);
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const mode = t || (prefersDark ? 'dark' : 'light');
  document.documentElement.classList.toggle('dark', mode === 'dark');
}

function toggleTheme() {
  const isDark = document.documentElement.classList.contains('dark');
  const next = isDark ? 'light' : 'dark';
  localStorage.setItem(CONFIG.THEME_KEY, next);
  applyThemeFromStorage();
}

function layoutShell(user) {
  const navItems = buildNav(user.role);

  return h('div', { class:'h-full flex' }, [
    // Sidebar
    h('aside', { class:'hidden md:flex md:w-64 flex-col border-r border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-950/60 backdrop-blur' }, [
      h('div', { class:'p-5' }, [
        h('div', { class:'flex items-center gap-3' }, [
          h('div', { class:'w-10 h-10 rounded-2xl bg-emerald-500/15 dark:bg-emerald-400/15 flex items-center justify-center text-xl' }, '🌴'),
          h('div', {}, [
            h('div', { class:'font-semibold leading-tight' }, CONFIG.APP_TITLE),
            h('div', { class:'text-xs text-slate-500 dark:text-slate-400' }, user.role + ' • ' + user.name),
          ])
        ])
      ]),
      h('nav', { class:'px-3 pb-4 space-y-1 overflow-auto' },
        navItems.map(it => navLink(it))
      ),
      h('div', { class:'mt-auto p-4 border-t border-slate-200 dark:border-slate-800' }, [
        h('button', { class:'w-full rounded-xl px-3 py-2 text-sm border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900', onclick: ()=>toggleTheme() }, 'Toggle Dark/Light'),
        h('button', { class:'mt-2 w-full rounded-xl px-3 py-2 text-sm bg-rose-600 text-white hover:bg-rose-700', onclick: ()=>logout() }, 'Logout')
      ])
    ]),
    // Main
    h('main', { class:'flex-1 min-w-0' }, [
      // Global header (konsisten untuk semua menu)
      h('header', { id:'globalHeader', class:'sticky top-0 z-40 border-b border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-950/60 backdrop-blur' }),
      // Mobile nav chips (tetap ada di bawah header)
      h('div', { class:'md:hidden border-b border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/40 backdrop-blur' }, [
        h('div', { class:'px-3 py-3 flex gap-2 overflow-x-auto' }, navItems.map(it => navChip(it)))
      ]),
      h('div', { id:'view', class:'p-4 md:p-6 max-w-6xl mx-auto' })
    ])
  ]);
}

function navLink(it) {
  return h('button', {
    class:'w-full text-left px-3 py-2 rounded-xl text-sm hover:bg-slate-100 dark:hover:bg-slate-900 flex items-center justify-between',
    onclick: ()=>go(it.key)
  }, [
    h('span', { class:'flex items-center gap-2' }, [
      h('span', { class:'text-base' }, it.icon || '•'),
      h('span', {}, it.label),
    ]),
    h('span', { class:'text-xs text-slate-400' }, '›')
  ]);
}

function navChip(it) {
  return h('button', {
    class:'shrink-0 px-3 py-2 rounded-xl text-sm border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900',
    onclick: ()=>go(it.key)
  }, it.label);
}

function buildNav(role) {
  const R = (r)=>{
    const x = String(r||'').trim().toUpperCase();
    return x === 'ADMINISTRATOR' ? 'ADMIN' : x;
  };
  role = R(role);

  const common = [
    { key:'sync', label:'Sinkronisasi', icon:'🔄' },
  ];
  const admin = [
    { key:'dashboard', label:'Dashboard', icon:'📊' },
    { key:'programs', label:'Program', icon:'🗂️' },
    { key:'candidates', label:'Calon', icon:'🧾' },
    { key:'selection', label:'Seleksi', icon:'✅' },
    { key:'participants', label:'Peserta', icon:'👷' },
    { key:'mentors', label:'Mentor & Pairing', icon:'🤝' },
    { key:'monitoring', label:'Monitoring', icon:'📝' },
    { key:'graduation', label:'Kelulusan', icon:'🎓' },
    { key:'certificates', label:'Sertifikat', icon:'📜' },
    { key:'incentives', label:'Insentif', icon:'💰' },
    { key:'settings', label:'Pengaturan', icon:'⚙️' },
  ];

  const manager = [
    { key:'dashboard', label:'Dashboard', icon:'📊' },
    { key:'programs', label:'Program', icon:'🗂️' },
    { key:'candidates', label:'Calon', icon:'🧾' },
    { key:'selection', label:'Seleksi', icon:'✅' },
    { key:'participants', label:'Peserta', icon:'👷' },
    { key:'mentors', label:'Mentor & Pairing', icon:'🤝' },
    { key:'monitoring', label:'Monitoring', icon:'📝' },
    { key:'graduation', label:'Kelulusan', icon:'🎓' },
    { key:'certificates', label:'Sertifikat', icon:'📜' },
    { key:'incentives', label:'Insentif', icon:'💰' },
    { key:'settings', label:'Ganti PIN', icon:'⚙️' },
  ];

  const ktu = [
    { key:'candidates', label:'Calon', icon:'🧾' },
    { key:'selection', label:'Seleksi', icon:'✅' },
    { key:'participants', label:'Peserta', icon:'👷' },
    { key:'monitoring', label:'Monitoring', icon:'📝' },
    { key:'certificates', label:'Sertifikat', icon:'📜' },
    { key:'incentives', label:'Insentif', icon:'💰' },
    { key:'settings', label:'Ganti PIN', icon:'⚙️' },
  ];
  const asisten = [
    { key:'participants', label:'Peserta', icon:'👷' },
    { key:'mentors', label:'Pairing', icon:'🤝' },
    { key:'monitoring', label:'Monitoring', icon:'📝' },
    { key:'settings', label:'Ganti PIN', icon:'⚙️' },
  ];
  const mandor = [
    { key:'participants', label:'Peserta', icon:'👷' },
    { key:'mentors', label:'Mentor & Pairing', icon:'🤝' },
    { key:'monitoring', label:'Monitoring Harian', icon:'📝' },
    { key:'settings', label:'Ganti PIN', icon:'⚙️' },
  ];
  const mentor = [
    { key:'mymentee', label:'Mentee Saya', icon:'🤝' },
    { key:'monitoring', label:'Log Harian', icon:'📝' },
    { key:'settings', label:'Ganti PIN', icon:'⚙️' },
  ];

  const peserta = [
    { key:'certificates', label:'Sertifikat Saya', icon:'📜' },
    { key:'settings', label:'Ganti PIN', icon:'⚙️' },
  ];

  if (role === 'ADMIN') return [...common, ...admin];
  if (role === 'MANAGER') return [...common, ...manager];
  if (role === 'KTU') return [...common, ...ktu];
  if (role === 'ASISTEN') return [...common, ...asisten];
  if (role === 'MANDOR') return [...common, ...mandor];
  if (role === 'MENTOR') return [...common, ...mentor];
  if (role === 'PESERTA') return [...common, ...peserta];
  return common;
}

let state = {
  user: null,
  program: null,
  programs: [],
  programContextId: '',
  viewKey: 'dashboard',
  candidates: [],
  participants: [],
  mentors: [],
  pairings: [],
  dailyLogs: []
};


function currentProgramId_() {
  // Global program context (dipakai untuk semua endpoint). Backend tetap melakukan scope check.
  return String(state.programContextId||'').trim();
}

// ======================
// OFFLINE HELPERS
// ======================
async function offlineList_(store, fetchFn, filter = {}) {
  // 1) tampilkan cache dulu (kalau ada)
  const cached = await cacheGetAll(store, filter);
  let meta = await cacheMeta(store);
  // 2) coba refresh dari server; kalau gagal, pakai cache
  try {
    const r = await fetchFn();
    if (r && r.ok) {
      // caller will pass normalized rows
      return { ok:true, from:'server', data: r, cached, meta };
    }
    return { ok:false, from:'server', data: r, cached, meta };
  } catch (e) {
    return { ok:true, from:'cache', data: { ok:true }, cached, meta, offline_error: String(e && e.message ? e.message : e) };
  }
}

function normalizeRows_(rows, idKey) {
  return (rows || []).map(x => ({ id: String(x[idKey] || ''), data: x }));
}

async function boot() {
  applyThemeFromStorage();
  const token = localStorage.getItem(CONFIG.TOKEN_KEY) || '';
  if (!token) return renderLogin();

  try {
    const me = await callApi('me', {});
    if (!me.ok) throw new Error(me.error || 'Session invalid');
    state.user = me.user;
    await offlineInit();
    await preload();
    renderApp('dashboard');
  } catch (e) {
    localStorage.removeItem(CONFIG.TOKEN_KEY);
    renderLogin();
  }
}

async function preload() {
  const p = await callApi('listPrograms', {});
  if (p.ok) {
    state.programs = p.programs || [];
    state.program = p.activeProgram || null;
    state.myEstate = p.myEstate || (state.user && (state.user.estate_code || state.user.estate) || '');
    state.myActiveProgramId = p.myActiveProgramId || '';
    state.activeProgramsByEstate = p.activeProgramsByEstate || {};
    state.estates = p.estates || state.estates || [];
    // Default program context:
    const stored = (localStorage.getItem(CONFIG.PROGRAM_KEY) || '').trim();
    const role = (String(state.user?.role || '').trim().toUpperCase()==='ADMINISTRATOR') ? 'ADMIN' : String(state.user?.role || '').trim().toUpperCase();
    const isAll = stored === '__ALL__';

    const exists =
      (isAll && role === 'ADMIN') ||
      (stored && state.programs.some(x => String(x.program_id || '') === stored));

    const fallback = (state.program && state.program.program_id) ? state.program.program_id : '';
    state.programContextId = exists ? stored : fallback;

    localStorage.setItem(CONFIG.PROGRAM_KEY, state.programContextId || '');
  }
}


function renderLogin() {
  $app.innerHTML = '';
  const card = h('div', { class:'min-h-full flex items-center justify-center p-6' }, [
    h('div', { class:'w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-950/60 backdrop-blur shadow-sm p-6' }, [
      h('div', { class:'flex items-center justify-between' }, [
        h('div', {}, [
          h('div', { class:'text-2xl font-semibold' }, CONFIG.APP_TITLE),
          h('div', { class:'text-sm text-slate-500 dark:text-slate-400 mt-1' }, 'Login'),
        ]),
        h('button', { class:'rounded-xl px-3 py-2 text-sm border border-slate-200 dark:border-slate-800', onclick: ()=>toggleTheme() }, 'Theme')
      ]),
      h('div', { class:'mt-6 space-y-3' }, [
        h('div', {}, [
          h('label', { class:'text-sm text-slate-600 dark:text-slate-300' }, 'NIK'),
          h('input', { id:'nik', class:'mt-1 w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500', placeholder:'contoh: 123' })
        ]),
        h('div', {}, [
          h('label', { class:'text-sm text-slate-600 dark:text-slate-300' }, 'PIN'),
          h('input', { id:'pin', type:'password', class:'mt-1 w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500', placeholder:'contoh: 1234' })
        ]),
        h('button', { id:'btnLogin', class:'w-full rounded-2xl bg-emerald-600 text-white py-3 font-medium hover:bg-emerald-700 flex items-center justify-center gap-2' }, [
          h('span', { 'data-spinner':'', class:'hidden w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin' }),
          h('span', { 'data-label':'', 'data-orig':'Masuk' }, 'Masuk')
        ]),
        h('div', { class:'text-xs text-slate-500 dark:text-slate-400' }, 'Tip: ganti PIN setelah login.')
      ])
    ])
  ]);
  $app.appendChild(card);

  const btn = document.getElementById('btnLogin');
  btn.addEventListener('click', async () => {
    const nik = (document.getElementById('nik').value || '').trim();
    const pin = (document.getElementById('pin').value || '').trim();
    if (!nik || !pin) return toast('NIK dan PIN wajib diisi', 'error');

    btnBusy(btn, true, 'Login...');
    try {
      const res = await callApi('login', { nik, pin });
      if (!res.ok) throw new Error(res.error || 'Login gagal');
      localStorage.setItem(CONFIG.TOKEN_KEY, res.token);
      toast('Login berhasil', 'ok');
      state.user = res.user;
      await preload();
      renderApp('dashboard');
    } catch (e) {
      toast(e.message || 'Login gagal', 'error');
    } finally {
      btnBusy(btn, false, 'Masuk');
    }
  });
}

function logout() {
  localStorage.removeItem(CONFIG.TOKEN_KEY);
  state = { user:null, program:null, programs:[], programContextId:'', viewKey:'dashboard', candidates:[], participants:[], mentors:[], pairings:[], dailyLogs:[] };
  renderLogin();
}

function renderApp(initialViewKey) {
  $app.innerHTML = '';
  const shell = layoutShell(state.user);
  $app.appendChild(shell);
  renderGlobalHeader_();
  go(initialViewKey || 'dashboard');
}

function setViewTitle(title, subtitle='') {
  const v = document.getElementById('view');
  v.innerHTML = '';
  v.appendChild(h('div', { class:'mb-5' }, [
    h('div', { class:'text-2xl md:text-3xl font-semibold' }, title),
    subtitle ? h('div', { class:'text-sm text-slate-500 dark:text-slate-400 mt-1' }, subtitle) : null
  ]));
  return v;
}

function renderGlobalHeader_() {
  const host = document.getElementById('globalHeader');
  if (!host) return;
  host.innerHTML = '';

  const role = state.user?.role || '';
  const roleN = (String(role||'').trim().toUpperCase()==='ADMINISTRATOR') ? 'ADMIN' : String(role||'').trim().toUpperCase();
  const myEstate = state.myEstate || state.user?.estate || '';
  const activePid = state.myActiveProgramId || '';

  const programs = (state.programs || []).slice().sort((a,b)=>{
    // Urutkan: ACTIVE, DRAFT, CLOSED; lalu terbaru
    const w = (s)=> (String(s||'').toUpperCase()==='ACTIVE' ? 0 : String(s||'').toUpperCase()==='DRAFT' ? 1 : 2);
    const wa=w(a.status), wb=w(b.status);
    if (wa!==wb) return wa-wb;
    return String(b.created_at||b.period_start||'').localeCompare(String(a.created_at||a.period_start||''));
  });

  const sel = h('select', {
    id:'programCtxSelect',
    class:'w-full md:w-[420px] rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/70 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500'
  }, [
    // ADMIN bisa pilih semua program (tanpa filter)
    ...(roleN==='ADMIN'
      ? [h('option',{value:'__ALL__'}, 'Semua Program • (tanpa filter)')]
      : []),
    ...programs.map(p=>{
      const pid = String(p.program_id||'');
      const status = String(p.status||'DRAFT').toUpperCase();
      const range = p.period_start ? formatDateLongID(p.period_start) : '';
      const label = `${p.name || pid} • ${status}${range ? ' • ' + range : ''}`;
      return h('option',{value:pid}, label);
    })
  ]);

  sel.value = currentProgramId_() || '';

  const hint = (()=>{
    if (!myEstate) return 'Context Program (global)';
    if (roleN==='ADMIN') {
      return `Context Program • Estate saya: ${myEstate}${activePid?` (aktif: ${activePid.slice(0,8)}…)`:''}`;
    }
    return `Program aktif Estate ${myEstate}`;
  })();

  const bar = h('div', { class:'px-4 md:px-6 py-3 flex flex-col md:flex-row md:items-center gap-3 md:justify-between' }, [
    h('div', { class:'min-w-0 flex items-center gap-3' }, [
      h('div', { class:'w-10 h-10 rounded-2xl bg-emerald-500/15 dark:bg-emerald-400/15 flex items-center justify-center text-xl shrink-0' }, '🌴'),
      h('div', { class:'min-w-0' }, [
        h('div', { class:'font-semibold leading-tight truncate' }, CONFIG.APP_TITLE),
        h('div', { class:'text-xs text-slate-500 dark:text-slate-400 truncate' }, hint),
      ])
    ]),
    h('div', { class:'flex items-center gap-2 flex-wrap' }, [
      sel,
      h('button', { class:'rounded-xl px-3 py-2 text-sm border border-slate-200 dark:border-slate-800', onclick: ()=>toggleTheme() }, 'Theme'),
      h('button', { class:'rounded-xl px-3 py-2 text-sm bg-rose-600 text-white hover:bg-rose-700', onclick: ()=>logout() }, 'Logout'),
    ])
  ]);
  host.appendChild(bar);

  sel.addEventListener('change', async ()=>{
    const next = (sel.value||'').trim();
    state.programContextId = next;
    localStorage.setItem(CONFIG.PROGRAM_KEY, next);
    toast('Context program diperbarui', 'ok');
    // refresh current view
    await go(state.viewKey || 'dashboard');
  });
}

async function go(key) {
  const role = state.user?.role || '';
  if (!role) return renderLogin();

  state.viewKey = key;

  if (key === 'dashboard') return renderDashboard();
  if (key === 'sync') return renderSync();
  if (key === 'programs') return renderPrograms();
  if (key === 'candidates') return renderCandidates();
  if (key === 'selection') return renderSelection();
  if (key === 'participants') return renderParticipants();
  if (key === 'mentors') return renderMentors();
  if (key === 'monitoring') return renderMonitoring();
  if (key === 'graduation') return renderGraduation();
  if (key === 'certificates') return renderCertificates();
  if (key === 'incentives') return renderIncentives();
  if (key === 'mymentee') return renderMyMentee();
  if (key === 'settings') return renderSettings();
  toast('Menu belum tersedia', 'error');
}

function badge(text) {
  return h('span', { class:'inline-flex items-center px-2.5 py-1 rounded-full text-xs border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60' }, text);
}

function card(children) {
  return h('div', { class:'rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-950/50 backdrop-blur shadow-sm p-5' }, children);
}

// ======================
// MODAL HELPER (mobile friendly)
// ======================
function openModal_(opts = {}) {
  const {
    title = '',
    subtitle = 'Klik di luar untuk menutup',
    maxWidth = 'max-w-3xl',
    onClose = null,
    headerRight = null, // node (optional)
  } = opts;

  // lock background scroll
  const prevOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';

  const close = () => {
    try { overlay.remove(); } catch(e) {}
    document.body.style.overflow = prevOverflow || '';
    if (typeof onClose === 'function') onClose();
  };

  const overlay = h('div', {
    class: 'modal-overlay fixed inset-0 z-50 bg-black/40 overflow-y-auto'
  }, []);

  const wrap = h('div', {
    class: 'min-h-full flex items-start justify-center p-0 sm:p-4'
  }, []);

  const modal = h('div', {
    class:
      `w-full ${maxWidth} ` +
      `rounded-3xl border border-slate-200 dark:border-slate-800 ` +
      `bg-white/85 dark:bg-slate-950/70 backdrop-blur shadow-sm ` +
      `flex flex-col overflow-hidden ` +
      `max-h-[92vh] sm:max-h-[90vh] my-0 sm:my-6`
  }, []);

  const header = h('div', {
    class:
      'sticky top-0 z-10 ' +
      'bg-white/95 dark:bg-slate-950/90 backdrop-blur ' +
      'border-b border-slate-200 dark:border-slate-800 ' +
      'px-5 py-4'
  }, [
    h('div', { class: 'flex items-start justify-between gap-3' }, [
      h('div', {}, [
        h('div', { class: 'text-lg font-semibold leading-tight' }, title),
        subtitle ? h('div', { class: 'text-xs text-slate-500 dark:text-slate-400 mt-1' }, subtitle) : null,
      ]),
      h('div', { class: 'shrink-0 flex items-center gap-2' }, [
        headerRight || null,
        h('button', {
          class: 'rounded-xl px-3 py-2 text-sm border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900',
          onclick: close
        }, 'Tutup')
      ])
    ])
  ]);

  const body = h('div', {
    class: 'modal-scroll px-5 py-4 overflow-y-auto'
  }, []);

  modal.appendChild(header);
  modal.appendChild(body);

  wrap.appendChild(modal);
  overlay.appendChild(wrap);

  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  document.body.appendChild(overlay);

  return { overlay, modal, body, close };
}

function table(headers, rows) {
  return h('div', { class:'overflow-auto rounded-2xl border border-slate-200 dark:border-slate-800' }, [
    h('table', { class:'min-w-full text-sm' }, [
      h('thead', { class:'bg-slate-100 dark:bg-slate-900' }, [
        h('tr', {}, headers.map(hd => h('th', { class:'text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap' }, hd)))
      ]),
      h('tbody', { class:'divide-y divide-slate-200 dark:divide-slate-800' }, rows.map(r => h('tr', { class:'hover:bg-slate-50 dark:hover:bg-slate-900/40' }, r.map(td => h('td', { class:'px-4 py-3 whitespace-nowrap' }, td)))))
    ])
  ]);
}

// ======================
// SRC BADGE + LOCAL-FIRST MERGE HELPERS
// ======================
function srcBadge_(src, pending=false) {
  const s = String(src || '').toUpperCase() || 'NA';
  const base = 'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] border whitespace-nowrap';
  const dot = h('span',{class:'inline-block w-1.5 h-1.5 rounded-full bg-slate-400'},'');
  const label = pending ? `${s}*` : s;

  const cls =
    s === 'SERVER' ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/30 dark:border-emerald-900 dark:text-emerald-200' :
    s === 'CACHE'  ? 'bg-slate-50 border-slate-200 text-slate-700 dark:bg-slate-900/40 dark:border-slate-800 dark:text-slate-200' :
    s === 'LOCAL'  ? 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/30 dark:border-amber-900 dark:text-amber-200' :
                     'bg-slate-50 border-slate-200 text-slate-600 dark:bg-slate-900/40 dark:border-slate-800 dark:text-slate-300';

  // warna titik kecil mengikuti src
  if (s === 'SERVER') dot.className = 'inline-block w-1.5 h-1.5 rounded-full bg-emerald-500';
  if (s === 'CACHE')  dot.className = 'inline-block w-1.5 h-1.5 rounded-full bg-slate-400';
  if (s === 'LOCAL')  dot.className = 'inline-block w-1.5 h-1.5 rounded-full bg-amber-500';

  return h('span', { class: `${base} ${cls}`, title: pending ? 'Perubahan lokal belum terkirim (outbox)' : '' }, [
    dot,
    h('span', {}, label)
  ]);
}

function rowSrc_(row, fallback='SERVER') {
  if (!row) return fallback;
  if (row.__local_pending) return 'LOCAL';
  if (row.__src) return String(row.__src).toUpperCase();
  return fallback;
}

// merge cache + server: server menang, tapi keep LOCAL (pending) supaya tidak hilang
function mergeLocalFirst_(cachedRows, serverRows, idKey) {
  const map = new Map();

  // cache dulu
  (cachedRows || []).forEach(r=>{
    const id = String(r?.[idKey] || r?.id || '');
    if (!id) return;
    const rr = Object.assign({}, r);
    rr.__src = rr.__local_pending ? 'LOCAL' : (rr.__src || 'CACHE');
    map.set(id, rr);
  });

  // server override (kecuali jika cache itu LOCAL pending dan server belum punya update)
  (serverRows || []).forEach(r=>{
    const id = String(r?.[idKey] || r?.id || '');
    if (!id) return;
    const existing = map.get(id);
    if (existing && existing.__local_pending) {
      // tetap tampilkan versi lokal pending di atas data server
      // tapi simpan server snapshot jika diperlukan (opsional)
      existing.__server_shadow = r;
      existing.__src = 'LOCAL';
      map.set(id, existing);
    } else {
      const rr = Object.assign({}, r, { __src:'SERVER', __local_pending:false });
      map.set(id, rr);
    }
  });

  return Array.from(map.values());
}

async function localFirstList_(store, fetchFn, filter, idKey, serverPickKey=null, mapRow=null, cacheIdFn=null) {
  // 1) baca cache dulu
  const cached = await cacheGetAll(store, filter || {});
  const meta = await cacheMeta(store);

  const cachedNorm = (cached || []).map(x=>{
    const rr = Object.assign({}, x);
    rr.__src = rr.__local_pending ? 'LOCAL' : (rr.__src || 'CACHE');
    return rr;
  });

  // 2) fetch server
  try{
    const r = await fetchFn();
    if (r && r.ok) {
      const serverRows = serverPickKey
        ? (r[serverPickKey] || [])
        : (r.items || r.data || r.rows || []);

      const serverNorm = (serverRows || []).map(row=>{
        const base = Object.assign({}, row);
        const rr = (typeof mapRow === 'function') ? mapRow(base) : base;
        rr.__src = 'SERVER';
        rr.__local_pending = false;
        return rr;
      });

      const merged = mergeLocalFirst_(cachedNorm, serverNorm, idKey);

      const toCache = merged.map(row => ({
        id: String((typeof cacheIdFn === 'function')
          ? cacheIdFn(row)
          : (row[idKey] || row.id || '')
        ),
        data: Object.assign({}, row)
      })).filter(x=>x.id);

      await cacheReplace(store, toCache, filter || {});
      return { ok:true, from:'server', meta, items: merged };
    }
    return { ok:true, from:'cache', meta, items: cachedNorm, error: r?.error || '' };
  } catch(e){
    return { ok:true, from:'cache', meta, items: cachedNorm, error: String(e?.message || e) };
  }
}


// Local-first HYDRATE: render cache immediately, then refresh server in background (stale-while-revalidate).
// onUpdate({items, from:'cache'|'server', meta, error, refreshing})
function localFirstHydrateList_({ store, fetchFn, filter, idKey, serverPickKey=null, onUpdate, viewToken, mapRow=null, cacheIdFn=null }) {
  (async ()=>{
    const cached = await cacheGetAll(store, filter || {});
    const meta0 = await cacheMeta(store);
    const cachedNorm = (cached || []).map(x=>{
      const rr = Object.assign({}, x);
      rr.__src = rr.__local_pending ? 'LOCAL' : (rr.__src || 'CACHE');
      return rr;
    });
    try{ onUpdate && onUpdate({ items: cachedNorm, from:'cache', meta: meta0, error:'', refreshing:true }); } catch {}

    // Background refresh (do not block UI)
    setTimeout(async ()=>{
      try{
        const r = await fetchFn();
        if (!(r && r.ok)) {
          const meta1 = await cacheMeta(store);
          if (viewToken && viewToken() === false) return;
          return onUpdate && onUpdate({ items: cachedNorm, from:'cache', meta: meta1||meta0, error: r?.error||'Gagal', refreshing:false });
        }
        const serverRows = serverPickKey ? (r[serverPickKey] || []) : (r.items || r.data || r.rows || []);
        const merged = mergeLocalFirst_(cachedNorm, serverRows, idKey);
        const toCache = merged.map(row => ({ id: String((cacheIdFn ? cacheIdFn(row) : (row[idKey] || row.id || ''))), data: Object.assign({}, row) }));
        await cacheReplace(store, toCache, filter || {});
        const meta2 = await cacheMeta(store);
        if (viewToken && viewToken() === false) return;
        onUpdate && onUpdate({ items: merged, from:'server', meta: meta2, error:'', refreshing:false });
      } catch(e){
        const meta1 = await cacheMeta(store);
        if (viewToken && viewToken() === false) return;
        onUpdate && onUpdate({ items: cachedNorm, from:'cache', meta: meta1||meta0, error: String(e?.message || e), refreshing:false });
      }
    }, 0);
  })();
}


async function selectionCacheForProgram_(pid){
  // selection rows di IndexedDB (legacy) tidak punya program_id.
  // Kita filter dengan kandidat program (candidates cache).
  let cand = [];
  try { cand = await cacheGetAll('candidates', { program_id: pid }); } catch(e){}
  const allow = new Set((cand||[]).map(x=>String(x.candidate_id||'')));

  let raw = [];
  try { raw = await cacheGetAllRaw('selection'); } catch(e){}
  const items = (raw||[])
    .map(r => (r && r.data) ? r.data : r)
    .filter(x => allow.size ? allow.has(String(x.candidate_id||'')) : true)
    .map(x => Object.assign({}, x, { __src: x.__local_pending ? 'LOCAL' : (x.__src || 'CACHE') }));
  return { items, hasCandidateScope: allow.size>0 };
}



function cacheInfoLine_(store, meta, extraText='') {
  const t = meta?.ts ? new Date(meta.ts).toLocaleString('id-ID') : '-';
  const msg = `Cache ${store}: ${t}${extraText ? ' • ' + extraText : ''}`;
  return h('div',{class:'mb-3 text-xs text-slate-500 dark:text-slate-400'}, msg);
}

function roleNormFront_(role){
  const r = String(role||'').trim().toUpperCase();
  return (r === 'ADMINISTRATOR') ? 'ADMIN' : r;
}


async function renderDashboard() {
  const role = roleNormFront_(state.user?.role || '');

  const selected = state.programs.find(x => String(x.program_id||'') === String(currentProgramId_()||'')) || null;
  const subtitle = selected
    ? `Context program: ${selected.name} • ${(selected.status||'').toUpperCase()} • ${formatDateDMYID(selected.period_start||'')}`
    : (state.program ? `Default: ${state.program.name} • ${(state.program.status||'').toUpperCase()} • ${formatDateDMYID(state.program.period_start||'')}` : 'Default: (belum diset)');

  const v = setViewTitle('Dashboard', subtitle);

  // Admin: overview semua program + mapping aktif per estate (drilldown)
  if (role === 'ADMIN') {
    const all = await callApi('dashboardAllPrograms', {});
    if (all && all.ok) {
      const estateRows = (all.estates||[]).map(r => ([
        `${r.estate_code}`,
        r.estate_name || '-',
        r.active_program_name ? `${r.active_program_name}` : '(belum diset)',
        r.active_program_status ? badge(r.active_program_status) : badge('NA'),
        r.active_program_id ? h('button',{
          class:'rounded-xl px-3 py-2 text-xs bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900',
          onclick: async ()=>{
            state.programContextId = r.active_program_id;
            localStorage.setItem(CONFIG.PROGRAM_KEY, state.programContextId);
            renderGlobalHeader_();
            await renderDashboard();
          }
        }, 'Drilldown') : h('span',{class:'text-xs text-slate-500 dark:text-slate-400'},'-')
      ]));

      const adminDetails = h('details',{class:'mt-4'},[
        h('summary',{class:'cursor-pointer select-none text-sm font-semibold text-slate-700 dark:text-slate-200'},'Admin: Ringkasan Program & Estate (klik untuk buka)')
      ]);
      const adminBody = h('div',{class:'mt-3 space-y-4'},[]);
      adminDetails.appendChild(adminBody);
      v.appendChild(adminDetails);

      adminBody.appendChild(h('div',{class:''},[
        h('div',{class:'text-lg font-semibold'},'Dashboard Admin - Semua Estate'),
        h('div',{class:'text-sm text-slate-500 dark:text-slate-400 mt-1'},'Ringkasan program aktif per estate (klik Drilldown untuk melihat detail program).'),
        card([ table(['Estate','Nama','Program Aktif','Status','Aksi'], estateRows) ])
      ]));

      // Optional: ringkasan program (top list)
      const progRows = (all.programs||[]).slice(0, 30).map(pr => ([
        pr.name || pr.program_id,
        badge(pr.status||'NA'),
        String(pr.participants_total||0),
        String(pr.logs_today_total||0),
        h('button',{
          class:'rounded-xl px-3 py-2 text-xs border border-slate-200 dark:border-slate-800',
          onclick: async ()=>{
            state.programContextId = pr.program_id;
            localStorage.setItem(CONFIG.PROGRAM_KEY, state.programContextId);
            renderGlobalHeader_();
            await renderDashboard();
          }
        }, 'Lihat')
      ]));
      adminBody.appendChild(h('div',{class:''},[
        h('div',{class:'text-sm font-semibold'},'Ringkasan Program (30 terbaru)'),
        card([ table(['Program','Status','Peserta','Log Hari Ini', 'Aksi'], progRows) ])
      ]));
    }
  }

  const res = await callApi('dashboard', { program_id: currentProgramId_() || '' });
  if (!res.ok) {
    const msg = res.error || 'Gagal load dashboard';
    const hint = (String(msg).toLowerCase().includes('activeprogramid') || String(msg).toLowerCase().includes('belum diset'))
      ? 'Catatan: jika program aktif estate belum diset, buka menu Program lalu klik Jadikan Aktif pada program estate Anda.'
      : '';
    return v.appendChild(card([
      h('div',{class:'text-rose-600 font-semibold'}, msg),
      hint ? h('div',{class:'text-xs text-slate-500 dark:text-slate-400 mt-2'}, hint) : null,
    ].filter(Boolean)));
  }

  const s = res.stats || {};
  const canSeeCandidates = (role === 'ADMIN' || role === 'MANAGER' || role === 'KTU');
  const cards = [
    ...(canSeeCandidates ? [{ key:'candidates', label:'Calon', value: s.candidates||0, hint:'Klik untuk lihat daftar', icon:'🧾' }] : []),
    { key:'participants', label:'Peserta A/B', value: s.participants||0, hint:'Klik untuk lihat daftar', icon:'👷' },
    { key:'mentors', label:'Mentor', value: s.mentors||0, hint:'Klik untuk lihat daftar', icon:'🤝' },
    { key:'alerts', label:'Alert', value: s.alerts||0, hint:'Belum input log hari ini', icon:'⚠️' },
  ];

  v.appendChild(h('div', { class:'grid md:grid-cols-4 gap-4' }, cards.map(c =>
    h('button', { class:'text-left', onclick:()=>openDashboardDetail(c.key, c.label) }, [
      card([
        h('div',{class:'flex items-center justify-between'},[
          h('div',{class:'text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2'},[h('span',{},c.icon), h('span',{},c.label)]),
          h('span',{class:'text-xs text-slate-400'},'›')
        ]),
        h('div',{class:'text-3xl font-semibold mt-2'}, String(c.value)),
        h('div',{class:'text-xs text-slate-500 dark:text-slate-400 mt-2'}, c.hint)
      ])
    ])
  )));

  // Charts
  const chartWrap = h('div', { class:'mt-6 grid lg:grid-cols-2 gap-4' }, [
    card([
      h('div',{class:'font-semibold'},'Peserta per Kategori'),
      h('div',{class:'text-xs text-slate-500 dark:text-slate-400 mt-1'},'Distribusi A/B/C'),
      h('div',{class:'mt-4'},[h('canvas',{id:'chartDonut', height:'220'})])
    ]),
    card([
      h('div',{class:'font-semibold'},'Log Harian (7 Hari Terakhir)'),
      h('div',{class:'text-xs text-slate-500 dark:text-slate-400 mt-1'},'Jumlah input log'),
      h('div',{class:'mt-4'},[h('canvas',{id:'chartBar', height:'220'})])
    ])
  ]);
  v.appendChild(chartWrap);

  try { renderCharts(res.chartData || {}); } catch(e) {}
}
// Dashboard helper: preload mentors agar dashboard detail bisa tampilkan nama mentor (bukan ID)
async function ensureMentorsDataForDashboard_(programId){
  const pid = String(programId || '').trim();
  if (!pid) return [];

  // cache in-memory per program
  if (window.__dashMentorsPid === pid && Array.isArray(window.mentorsData)) return window.mentorsData;

  // 1) coba ambil dari IndexedDB dulu
  let cached = [];
  try { cached = await cacheGetAll('mentors', { program_id: pid }); } catch(e) {}
  if (Array.isArray(cached) && cached.length) {
    window.mentorsData = cached;
    window.__dashMentorsPid = pid;
    return cached;
  }

  // 2) kalau kosong, tarik dari server lalu cache
  try {
    const res = await callApi('listMentors', { program_id: pid });
    if (res && res.ok) {
      const serverMentors = (res.mentors || []).map(x => Object.assign({}, x, { __src:'SERVER', __local_pending:false }));
      try {
        await cacheReplace('mentors', normalizeRows_(serverMentors, 'mentor_id'), { program_id: pid });
      } catch(e) {}
      window.mentorsData = serverMentors;
      window.__dashMentorsPid = pid;
      return serverMentors;
    }
  } catch(e) {}

  window.mentorsData = [];
  window.__dashMentorsPid = pid;
  return [];
}

function renderCharts(chartData){
  const byCat = chartData.participantsByCategory || {};
  const donutLabels = Object.keys(byCat);
  const donutValues = donutLabels.map(k => byCat[k]||0);

  const dl = chartData.dailyLogsLast7Days || { labels:[], values:[] };

  const donutEl = document.getElementById('chartDonut');
  const barEl = document.getElementById('chartBar');
  if (!donutEl || !barEl || !window.Chart) return;

  // destroy if already exists
  if (donutEl._chart) { donutEl._chart.destroy(); }
  if (barEl._chart) { barEl._chart.destroy(); }

  donutEl._chart = new Chart(donutEl, {
    type: 'doughnut',
    data: { labels: donutLabels, datasets: [{ data: donutValues }] },
    options: {
      responsive:true,
      plugins:{ legend:{ position:'bottom' } },
      onClick: (evt, elements) => {
        try{
          if (!elements || !elements.length) return;
          const idx = elements[0].index;
          const cat = donutLabels[idx];
          if (!cat) return;
          // Klik donut => buka detail peserta per kategori
          openDashboardDetail('participants', `Peserta Kategori ${cat}`, { category: cat });
        } catch(e) {}
      }
    }
  });

  barEl._chart = new Chart(barEl, {
    type: 'bar',
    data: { labels: dl.labels || [], datasets: [{ label: 'Log', data: dl.values || [] }] },
    options: { responsive:true, plugins:{ legend:{ display:false } }, scales:{ y:{ beginAtZero:true } } }
  });
}

async function openDashboardDetail(type, title, extraParams={}){
  const role = roleNormFront_(state.user?.role || '');

  if (type === 'candidates' && !(role === 'ADMIN' || role === 'MANAGER' || role === 'KTU')) {
    toast('Akses ditolak: hanya ADMIN/MANAGER/KTU', 'error');
    return;
  }

  const holder = h('div',{class:'mt-1'},[
    h('div',{class:'text-sm text-slate-500 dark:text-slate-400'},'Memuat...')
  ]);

  const { body } = openModal_({
    title,
    subtitle: 'Scroll konten di bawah. Klik di luar untuk menutup.',
    maxWidth: 'max-w-4xl'
  });

  body.appendChild(holder);

  // PRELOAD mentors agar tabel peserta/alert bisa tampilkan nama mentor (bukan mentor_id)
  const pid = currentProgramId_() || '';
  let mentorsData = [];
  if (type === 'participants' || type === 'alerts') {
    mentorsData = await ensureMentorsDataForDashboard_(pid);
  }
  const mentorMap = new Map((mentorsData||[]).map(m => [String(m.mentor_id||''), m]));

  const payload = Object.assign(
    { type, program_id: pid },
    (extraParams && typeof extraParams === 'object') ? extraParams : {}
  );

  const r = await callApi('dashboardDetail', payload);
  if (!r.ok) {
    holder.innerHTML = '';
    holder.appendChild(h('div',{class:'text-rose-600'}, r.error||'Gagal'));
    return;
  }

  const items = r.items || [];
  holder.innerHTML = '';
  if (!items.length) return holder.appendChild(h('div',{class:'text-slate-500'}, 'Tidak ada data'));

  if (type === 'alerts') {
    // Non-ADMIN: sebelumnya backend sudah kirim estate/divisi tapi UI tidak menampilkan => sekarang ditampilkan + nama mentor
    holder.appendChild(table(
      ['NIK','Nama','Kategori','Estate','Divisi','Mentor'],
      items.map(x=>{
        const mid = String(x.mentor_id || '').trim();
        const mentor = mentorMap.get(mid);
        const mentorName = mentor?.name || x.mentor_name || (mid || '-');
        return [
          x.nik||'-',
          x.name||'-',
          x.category||'-',
          x.estate||'-',
          x.divisi||'-',
          mentorName
        ];
      })
    ));
  } else if (type === 'candidates') {
    holder.appendChild(table(['NIK','Nama','Status','Updated'], items.map(x=>{
      const dateStr = x.updated_at || x.created_at;
      let displayDate = '-';
      if (dateStr && typeof dateStr === 'string' && dateStr.trim() !== '') {
        try { const formatted = formatDateISO(dateStr);  displayDate = (formatted && !formatted.includes('NaN')) ? formatted : '-'; } catch { displayDate = '-';}
      }
      return [x.nik || '-', x.name || '-', x.status || '-', displayDate ];
    })));
  } else if (type === 'participants') {
    holder.appendChild(table(
      ['NIK','Nama','Kategori','Status','Estate','Divisi','Mentor'],
      items.map(x=>{
        const mid = String(x.mentor_id || '').trim();
        const mentor = mentorMap.get(mid);
        const mentorName = mentor?.name || x.mentor_name || (mid || '-');
        return [
          x.nik||'-',
          x.name||'-',
          x.category||'-',
          x.status||'-',
          x.estate||'-',
          x.divisi||'-',
          mentorName
        ];
      })
    ));
  } else if (type === 'mentors') {
    holder.appendChild(table(['NIK','Nama','Status'], items.map(x=>[x.nik||'-', x.name||'-', x.status||'-'])));
  } else {
    holder.appendChild(pre(JSON.stringify(items, null, 2)));
  }
}

async function renderPrograms(opts={}) {
  const skipBg = !!opts.skipBg;
  const v = setViewTitle('Program', 'Kelola batch Sekolah Pemanen');

  const roleN = (String(state.user?.role||'').trim().toUpperCase()==='ADMINISTRATOR')
    ? 'ADMIN'
    : String(state.user?.role||'').trim().toUpperCase();

  const isAdmin = roleN === 'ADMIN';
  const isManager = roleN === 'MANAGER';

  // ADMIN & MANAGER boleh buat program. KTU tidak.
  const canCreateProgram = isAdmin || isManager;

  // ADMIN & MANAGER boleh set ACTIVE / close (backend sudah guard scope untuk MANAGER).
  const canManagePrograms = isAdmin || isManager;

  // Local-first: render cache immediately (programs + master estates), refresh server in background.
  const cachedPrograms = await cacheGetAll('programs', { estate: '' });
  const cachedEstates  = await cacheGetAll('master_estates', { estate: '' });
  if (cachedPrograms && cachedPrograms.length) state.programs = cachedPrograms;
  if (cachedEstates && cachedEstates.length) state.estates = cachedEstates;

  let res = { ok:false, programs: state.programs||[], estates: state.estates||[], activeProgram: state.program||null, historyPrograms: [] };

  if (!skipBg) {
    callApi('listPrograms', {}).then(async (srv)=>{
      if (!(srv && srv.ok)) return;
      state.programs = srv.programs || [];
      state.program = srv.activeProgram || null;
      state.estates = srv.estates || state.estates || [];
      // cache snapshot for next open
      try{
        await cacheReplace('programs', normalizeRows_(state.programs, 'program_id'), { estate: '' });
        await cacheReplace('master_estates', (state.estates||[]).map(x=>({ id:String(x.estate_code||''), data:x })), { estate: '' });
      }catch(e){}
      if (state.viewKey === 'programs') renderPrograms({ skipBg:true });
    }).catch(()=>{});
  }

    const top = h('div', { class:'flex flex-col md:flex-row md:items-center gap-3 mb-4' }, [
    h('div', { class:'text-sm text-slate-500 dark:text-slate-400' }, 'Pilih program aktif untuk operasional harian.'),
    h('div', { class:'md:ml-auto flex gap-2' }, [
      ...(canCreateProgram ? [
        h('button', { id:'btnNewProgram', class:'rounded-2xl px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700 text-sm' }, 'Buat Program')
      ] : []),
      h('button', { class:'rounded-2xl px-4 py-2 border border-slate-200 dark:border-slate-800 text-sm', onclick: ()=>preload().then(()=>renderPrograms()) }, 'Refresh')
    ])
  ]);
  v.appendChild(top);

  // Admin: set active program per estate (parallel multi-estate)
  if (isAdmin) {
    const estates = (state.estates || []).slice().sort((a,b)=>String(a.estate_code||'').localeCompare(String(b.estate_code||'')));
    const progOptions = (state.programs || []).filter(p => String(p.status||'').toUpperCase() !== 'CLOSED');
    const curEstate = (state.myEstate || (state.user&&state.user.estate) || (estates[0]&&estates[0].estate_code) || '').toUpperCase();
    const curProg = (state.program && state.program.program_id) ? state.program.program_id : (progOptions[0] && progOptions[0].program_id) || '';

    const box = card([
      h('div',{class:'text-sm font-semibold'},'Aktifkan Program per Estate (parallel)'),
      h('div',{class:'text-sm text-slate-500 dark:text-slate-400 mt-1'},'Pilih Estate dan Program yang ingin dijadikan aktif untuk operasional harian.'),
      h('div',{class:'mt-4 grid md:grid-cols-3 gap-3'},[
        selectField('Estate','adminEstateSel',
          estates.map(e=>({ value:e.estate_code, label:`${e.estate_code} • ${e.estate_name||''}` })), curEstate),
        selectField('Program','adminProgramSel',
          progOptions.map(p=>({ value:p.program_id, label:`${p.name} • ${String(p.status||'').toUpperCase()}` })), curProg),
        h('div',{class:'flex items-end'},[
          h('button',{id:'btnAdminSetActive', class:'w-full rounded-2xl px-4 py-2 bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 text-sm flex items-center justify-center gap-2'},[
            h('span',{'data-spinner':'', class:'hidden w-4 h-4 border-2 border-white/40 border-t-white dark:border-slate-900/30 dark:border-t-slate-900 rounded-full animate-spin'}),
            h('span',{'data-label':'','data-orig':'Jadikan Aktif'},'Jadikan Aktif')
          ])
        ])
      ])
    ]);
    box.classList.add('mb-4');
    v.appendChild(box);

    document.getElementById('btnAdminSetActive').onclick = async (ev)=>{
      const btn = ev.currentTarget;
      btnBusy(btn, true);
      try{
        const estate_code = String(document.getElementById('adminEstateSel').value||'').trim().toUpperCase();
        const program_id = String(document.getElementById('adminProgramSel').value||'').trim();
        const r = await callApi('setActiveProgram', { program_id, estate_code });
        if (!r.ok) return toast(r.error||'Gagal set active', 'error');
        toast(`Aktif: ${estate_code} -> ${program_id}`, 'ok');
        await preload();
        renderPrograms();
      } finally { btnBusy(btn, false); }
    };
  }

  const openPrograms = (state.programs || []).filter(p => String(p.status||'').toUpperCase() !== 'CLOSED');
  const historyPrograms = (res.historyPrograms || []).slice().sort((a,b)=>String(b.closed_at||'').localeCompare(String(a.closed_at||'')));

  const rows = openPrograms.map(p => {
    const st = String(p.status||'').toUpperCase() || 'DRAFT';

    // One main action button (per requirement):
    const actionEl = (()=>{
      if (!canManagePrograms) return h('span',{class:'text-xs text-slate-500 dark:text-slate-400'},'-');
      if (st === 'DRAFT') {
        return h('button', {
          class:'rounded-xl px-3 py-2 text-xs bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900',
          onclick: async ()=>{
            const estate_code = isAdmin
              ? String((document.getElementById('adminEstateSel') && document.getElementById('adminEstateSel').value) || state.myEstate || '').trim().toUpperCase()
              : String((state.myEstate || (state.user&&state.user.estate) || '')).trim().toUpperCase();
            const r = await callApi('setActiveProgram', { program_id: p.program_id, estate_code });
            if (!r.ok) return toast(r.error||'Gagal set active', 'error');
            toast('Program diaktifkan', 'ok');
            await preload();
            renderPrograms();
          }
        }, 'Jadikan Aktif');
      }
      if (st === 'ACTIVE') {
        return h('button', {
          class:'rounded-xl px-3 py-2 text-xs bg-rose-600 text-white hover:bg-rose-700',
          onclick: async ()=>{
            const ok = confirm(`Tutup program "${p.name}"?\nStatus akan menjadi CLOSED dan masuk History Program.`);
            if (!ok) return;
            const r = await callApi('closeProgram', { program_id: p.program_id });
            if (!r.ok) return toast(r.error||'Gagal close program', 'error');
            toast('Program ditutup (CLOSED)', 'ok');
            await preload();
            renderPrograms();
          }
        }, 'Tutup');
      }
      return h('span',{class:'text-xs text-slate-500 dark:text-slate-400'},'-');
    })();

    return ([
      p.name,
      badge(st),
      (p.period_start ? formatDateLongID(p.period_start) : '-'),
      p.location || '-',
      actionEl
    ]);
  });

  v.appendChild(card([
    table(['Nama','Status','Mulai','Lokasi','Aksi'], rows)
  ]));

  // ===== History Program (CLOSED) =====
  v.appendChild// ===== History Program (CLOSED) =====
  v.appendChild(h('div',{class:'mt-6'},[
    h('div',{class:'text-lg font-semibold'},'History Program'),
    h('div',{class:'text-sm text-slate-500 dark:text-slate-400 mt-1'},'Program yang sudah CLOSED.'),
    card([
      table(
        ['Nama','Status','Mulai','Ditutup','Lokasi'],
        historyPrograms.map(p => ([
          p.name,
          badge('CLOSED'),
          p.period_start ? formatDateLongID(p.period_start) : '-',
          p.closed_at ? formatDateLongID(p.closed_at) : '-',
          p.location || '-',
        ]))
      )
    ])
  ]));

  const btnNP = document.getElementById('btnNewProgram');
  if (btnNP) btnNP.onclick = () => openProgramModal();
}

function openProgramModal() {
  const roleN = (String(state.user?.role||'').trim().toUpperCase()==='ADMINISTRATOR')
    ? 'ADMIN'
    : String(state.user?.role||'').trim().toUpperCase();

  const isManager = roleN === 'MANAGER';
  const myEstate = String(state.myEstate || (state.user && state.user.estate) || '').trim().toUpperCase();

  const { body, close } = openModal_({
    title: 'Buat Program Baru',
    subtitle: 'Isi form sesuai dengan contoh.',
    maxWidth: 'max-w-2xl'
  });

  // period default: start hari ini, end +2 bulan
  const start = new Date();
  const end = new Date(start);
  end.setMonth(end.getMonth() + 2);

  body.appendChild(h('div',{class:'grid md:grid-cols-2 gap-3'},[
    field('Nama Program','name','SP-BDU-SRIE-2026-B1'),
    // MANAGER: lokasi terkunci & otomatis myEstate
    field('Lokasi','location','Estate / TC', { locked: isManager, value: (isManager ? myEstate : '') }),
    field('Mulai (YYYY-MM-DD)','period_start', formatDateISO(start)),
    field('Selesai (YYYY-MM-DD)','period_end', formatDateISO(end)),
    field('Kuota','quota','30'),
  ]));

  body.appendChild(h('div',{class:'mt-5 flex justify-end gap-2'},[
    h('button',{class:'rounded-2xl px-4 py-2 text-sm border border-slate-200 dark:border-slate-800', onclick: close},'Batal'),
    h('button',{id:'btnSaveProgram', class:'rounded-2xl px-4 py-2 text-sm bg-emerald-600 text-white hover:bg-emerald-700 flex items-center gap-2'},[
      h('span',{'data-spinner':'', class:'hidden w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin'}),
      h('span',{'data-label':'','data-orig':'Simpan'},'Simpan')
    ])
  ]));

  document.getElementById('btnSaveProgram').onclick = async ()=>{
    const btn = document.getElementById('btnSaveProgram');

    // IMPORTANT: untuk MANAGER, paksa location = myEstate
    const payload = {
      name: val('name'),
      location: isManager ? myEstate : val('location'),
      period_start: val('period_start'),
      period_end: val('period_end'),
      quota: val('quota')
    };

    btnBusy(btn,true,'Menyimpan...');
    try{
      const r = await callApi('createProgram', payload);
      if(!r.ok) throw new Error(r.error||'Gagal');
      toast('Program dibuat', 'ok');
      close();
      await preload();
      renderPrograms();
    }catch(e){
      toast(e.message,'error');
    }finally{
      btnBusy(btn,false,'Simpan');
    }
  };

  function field(label,id,ph, opts={}){
    const locked = !!opts.locked;

    // Bangun props input TANPA mengirim readOnly kalau tidak locked
    const inputProps = {
      id,
      placeholder: ph || '',
      class:
        'mt-1 w-full rounded-2xl border border-slate-200 dark:border-slate-800 ' +
        'bg-white dark:bg-slate-900 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500 ' +
        (locked ? 'opacity-80 cursor-not-allowed' : '')
    };

    if (opts.value !== undefined) inputProps.value = String(opts.value);

    // HANYA set readOnly ketika locked (hindari readonly="false")
    if (locked) inputProps.readOnly = true;

    return h('div',{},[
      h('label',{class:'text-sm text-slate-600 dark:text-slate-300'},label),
      h('input', inputProps)
    ]);
  }

  function val(id){ return (document.getElementById(id)?.value||'').trim(); }
}

function selectField(label, id, options, value) {
  return h('div', {}, [
    h('label', { class:'text-sm text-slate-600 dark:text-slate-300' }, label),
    h('select', { id, class:'mt-1 w-full rounded-2xl px-3 py-2 border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60' },
      (options||[]).map(o => h('option', { value:o.value, selected: String(o.value)===String(value) }, o.label))
    )
  ]);
}



async function renderCandidates() {
  const v = setViewTitle('Calon Pemanen', 'Administrasi & verifikasi berkas');
  const pid = currentProgramId_();

    const roleN = (String(state.user?.role||'').trim().toUpperCase()==='ADMINISTRATOR')
    ? 'ADMIN'
    : String(state.user?.role||'').trim().toUpperCase();

  const canAddCandidate = ['ADMIN','MANAGER','KTU'].includes(roleN);
  const canVerifyCandidate = ['ADMIN'].includes(roleN);


  const info = h('div',{class:'mb-3 text-xs text-slate-500 dark:text-slate-400'},'Memuat dari cache...');
  v.appendChild(info);

    const actions = h('div',{class:'flex gap-2 mb-4'},[
    ...(canAddCandidate ? [
      h('button',{class:'rounded-2xl px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700 text-sm', onclick:()=>openCandidateModal()},'Tambah Calon')
    ] : []),
    h('button',{class:'rounded-2xl px-4 py-2 border border-slate-200 dark:border-slate-800 text-sm', onclick:()=>renderCandidates()},'Refresh'),
  ]);
  v.appendChild(actions);

  const host = h('div',{},[
    card([ h('div',{class:'text-sm text-slate-500 dark:text-slate-400'},'Memuat...') ])
  ]);
  v.appendChild(host);

  localFirstHydrateList_({
    store: 'candidates',
    fetchFn: () => callApi('listCandidates', { program_id: pid }),
    filter: { program_id: pid },
    idKey: 'candidate_id',
    serverPickKey: 'candidates',
    viewToken: ()=> state.viewKey === 'candidates',
    onUpdate: ({ items, from, meta, error, refreshing })=>{
      state.candidates = items || [];
      info.textContent = `Cache Calon: ${meta?.ts ? new Date(meta.ts).toLocaleString('id-ID') : '-'} • ${refreshing ? 'refresh...' : (from==='server' ? 'SERVER refresh' : 'CACHE only')}${error ? (' • Offline: ' + error) : ''}`;

      const rows = (state.candidates||[]).map(c => ([
        srcBadge_(rowSrc_(c), !!c.__local_pending),
        c.nik,
        c.name,
        `${(c.estate||'-').toUpperCase()} / ${c.divisi||'-'}`,
        `${c.family_id||'-'} • ${c.relation||'-'}`,
        badge(c.admin_status || 'SUBMITTED'),
        c.applied_at ? formatDateDMYID(c.applied_at) : '-',
        docsBadge_(c),
        h('div',{class:'flex flex-wrap gap-2'},[
          ...(canAddCandidate ? [
            h('button',{class:'rounded-xl px-3 py-2 text-xs border border-slate-200 dark:border-slate-800', onclick:()=>openCandidateModal(c)},'Edit'),
          ] : [h('span',{class:'text-xs text-slate-500 dark:text-slate-400'},'-')]),

          ...(canVerifyCandidate ? [
            h('button',{class:'rounded-xl px-3 py-2 text-xs bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900', onclick:()=>verifyCandidate(c,'VERIFIED')},'Verifikasi'),
            h('button',{class:'rounded-xl px-3 py-2 text-xs bg-rose-600 text-white', onclick:()=>verifyCandidate(c,'REJECTED')},'Tolak'),
          ] : []),
        ])
      ]));

      host.innerHTML = '';
      host.appendChild(card([
        table(['SRC','NIK','Nama','Estate/Divisi','Keluarga','Status','Apply','Berkas','Aksi'], rows)
      ]));
    }
  });
}


function docsBadge_(c) {
  const items = [
    ['KTP', c.docs_ktp],
    ['KK', c.docs_kk],
    ['SKCK', c.docs_skck],
    ['KES', c.docs_health],
    ['FOTO', c.photo_url]
  ];
  const wrap = h('div',{class:'flex flex-wrap gap-1'});
  items.forEach(([k,v])=>{
    const ok = !!String(v||'').trim();
    wrap.appendChild(h('span', { class:`text-[11px] px-2 py-1 rounded-full border ${ok?'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-900 dark:text-emerald-200':'bg-slate-50 border-slate-200 text-slate-600 dark:bg-slate-900/40 dark:border-slate-800 dark:text-slate-300'}` }, k));
  });
  return wrap;
}

async function verifyCandidate(c, status) {
  const notes = prompt('Catatan (boleh kosong):', '');
  const payload = { candidate_id: c.candidate_id, admin_status: status, admin_notes: notes||'' };
  const r = await callOrQueue(() => callApi('verifyCandidate', payload), 'verifyCandidate', payload, 'Verifikasi calon');
  if (!r.ok) return toast(r.error||'Gagal', 'error');

  // optimistic cache update
  const pid = currentProgramId_();
  const merged = Object.assign({}, c, payload, { __local_pending: !!r.queued, __src: (r.queued ? 'LOCAL' : 'SERVER') });
  await cacheUpsert('candidates', { id: String(c.candidate_id), data: merged }, { program_id: pid });

  toast(r.queued ? 'Di-antrikan (offline). Nanti lakukan Sinkronisasi.' : 'Status diperbarui', 'ok');
  renderCandidates();
}

function openCandidateModal(cand=null) {
  const roleN = (String(state.user?.role||'').trim().toUpperCase()==='ADMINISTRATOR')
    ? 'ADMIN'
    : String(state.user?.role||'').trim().toUpperCase();

  const canAddCandidate = ['ADMIN','MANAGER','KTU'].includes(roleN);
  if (!canAddCandidate) {
    toast('Role Anda tidak memiliki hak untuk menambah/mengubah calon.', 'error');
    return;
  }
  const { body, close, modal, overlay } = openModal_({
    title: cand ? 'Edit Calon' : 'Tambah Calon',
    subtitle: 'Isi form sesuai dengan contoh.',
    maxWidth: 'max-w-3xl'
  });

  body.appendChild(h('div',{class:'grid md:grid-cols-3 gap-3'},[
    f('NIK','nik','contoh: 14023'),
    f('Nama','name',''),
    f('Gender (L/P)','gender','L'),
    f('Tanggal Lahir','dob','dd-mm-yyyy / yyyy'),
    f('No HP','phone',''),
    f('Pendidikan','education','SMP/SD/SMA/D3/S1'),
    f('Estate','estate','SRIE'),
    f('Divisi','divisi','1'),
    f('Source','source',''),

    // === RELATION (dropdown) ===
    h('div',{class:'flex flex-col gap-1'},[
      h('label',{class:'text-sm text-slate-600 dark:text-slate-300'},'Relation'),
      h('select',{
        id:'relation',
        class:'mt-1 w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500'
      },[
        ...['INDIVIDU','SUAMI','ISTRI','SAUDARA','TANDEM'].map(x => h('option',{value:x},x))
      ])
    ]),

    // === PARTNER (muncul jika relation butuh pasangan) ===
    h('div',{id:'partner_wrap', class:'flex flex-col gap-1 hidden'},[
      h('label',{class:'text-sm text-slate-600 dark:text-slate-300'},'Pasangan'),
      h('select',{
        id:'partner_candidate_id',
        class:'mt-1 w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500'
      },[
        h('option',{value:''},'-- pilih pasangan --')
      ]),
      h('div',{class:'text-[11px] text-slate-500 dark:text-slate-400'},'Wajib untuk SUAMI/ISTRI/SAUDARA/TANDEM')
    ]),

    // === FAMILY ID (readonly, otomatis) ===
    h('div',{class:'flex flex-col gap-1'},[
      h('label',{class:'text-sm text-slate-600 dark:text-slate-300'},'Family ID (otomatis)'),
      h('input',{
        id:'family_id',
        readOnly:true,
        class:'mt-1 w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 px-4 py-3 outline-none'
      })
    ]),

    h('div',{class:'md:col-span-3'},[
      h('label',{class:'text-sm text-slate-600 dark:text-slate-300'},'Alamat'),
      h('textarea',{id:'address', rows:'2', class:'mt-1 w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500'}, '')
    ]),

    h('div',{class:'md:col-span-3'},[
      h('div',{class:'text-sm text-slate-600 dark:text-slate-300 mb-2'},'Berkas (upload ke Drive)'),
      h('div',{class:'grid md:grid-cols-5 gap-2'},[
        fileBox_('KTP','docs_ktp'),
        fileBox_('KK','docs_kk'),
        fileBox_('SKCK','docs_skck'),
        fileBox_('Kesehatan','docs_health'),
        fileBox_('Foto','photo_url', true),
      ]),
      h('div',{id:'uploadHint', class:'text-xs text-slate-500 dark:text-slate-400 mt-2'}, cand ? 'Pilih file untuk upload/update.' : 'Simpan calon terlebih dahulu, lalu upload berkas.')
    ]),
  ]));

  body.appendChild(h('div',{class:'mt-5 flex justify-end gap-2'},[
    h('button',{class:'rounded-2xl px-4 py-2 text-sm border border-slate-200 dark:border-slate-800', onclick: close},'Batal'),
    h('button',{id:'btnSaveCandidate', class:'rounded-2xl px-4 py-2 text-sm bg-emerald-600 text-white hover:bg-emerald-700 flex items-center gap-2'},[
      h('span',{'data-spinner':'', class:'hidden w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin'}),
      h('span',{'data-label':'','data-orig':'Simpan'},'Simpan')
    ])
  ]));

  // ===========================
  // FAMILY PAIRING UI LOGIC
  // ===========================
  const relEl = document.getElementById('relation');
  const famEl = document.getElementById('family_id');
  const wrapEl = document.getElementById('partner_wrap');
  const partnerEl = document.getElementById('partner_candidate_id');

  relEl.value = (cand?.relation || 'INDIVIDU').toUpperCase();
  famEl.value = (cand?.family_id || '').trim();

  const all = (state.candidates || []).filter(x => x.candidate_id && x.candidate_id !== cand?.candidate_id);
  all.forEach(x => {
    const label = `${(x.nik||'').trim()} • ${(x.name||'').trim()}${x.family_id ? ' • ' + x.family_id : ''}`;
    partnerEl.appendChild(h('option',{value:x.candidate_id}, label));
  });

  if (cand?.family_id) {
    const mate = all.find(x => String(x.family_id||'').trim() === String(cand.family_id||'').trim());
    if (mate) partnerEl.value = mate.candidate_id;
  }

  const needsPartner = (r) => ['SUAMI','ISTRI','SAUDARA','TANDEM'].includes(String(r||'').toUpperCase());

  function refreshPartnerUI_() {
    const r = relEl.value;
    const need = needsPartner(r);

    if (need) {
      wrapEl.classList.remove('hidden');
      const pid = partnerEl.value;
      const p = all.find(x => x.candidate_id === pid);
      if (p && (p.family_id||'').trim()) {
        famEl.value = (p.family_id||'').trim();
      } else if (!famEl.value) {
        famEl.value = ('FAM-' + String(Date.now()).slice(-8)).toUpperCase();
      }
    } else {
      wrapEl.classList.add('hidden');
      partnerEl.value = '';
    }
  }

  relEl.addEventListener('change', refreshPartnerUI_);
  partnerEl.addEventListener('change', refreshPartnerUI_);
  refreshPartnerUI_();

  if (cand) {
    ['nik','estate','divisi','family_id','relation','name','gender','dob','phone','education','source'].forEach(id=>{
      const el = document.getElementById(id);
      if(el) el.value = cand[id] || '';
    });
    document.getElementById('address').value = cand.address || '';
  }

  // ✅ FIX: modal sekarang ada (dari openModal_ destructure)
  const hasId = !!(cand && cand.candidate_id);
  Array.from(modal.querySelectorAll('input[type="file"]')).forEach(inp=>{
    inp.disabled = !hasId;
  });

  document.getElementById('btnSaveCandidate').onclick = async ()=>{
    const btn = document.getElementById('btnSaveCandidate');
    btnBusy(btn,true,'Menyimpan...');
    try{
      const rel = (document.getElementById('relation').value || 'INDIVIDU').toUpperCase();
      const need = ['SUAMI','ISTRI','SAUDARA','TANDEM'].includes(rel);
      const pid  = (document.getElementById('partner_candidate_id')?.value || '').trim();
      if (need && !pid) {
        toast('Relation ' + rel + ' wajib pilih pasangan', 'error');
        return;
      }

      const localId = cand?.candidate_id || (crypto?.randomUUID ? crypto.randomUUID() : ('loc_' + Date.now() + '_' + Math.random().toString(36).slice(2)));

      const payload = {
        // ✅ hanya kirim candidate_id jika EDIT
        ...(cand?.candidate_id ? { candidate_id: cand.candidate_id } : {}),
        nik: val('nik'),
        name: val('name'),
        gender: val('gender'),
        dob: val('dob'),
        phone: val('phone'),
        source: val('source'),
        education: val('education'),
        estate: val('estate'),
        divisi: val('divisi'),
        relation: (document.getElementById('relation').value || 'INDIVIDU').toUpperCase(),
        family_id: (document.getElementById('family_id').value || '').trim(),
        partner_candidate_id: (document.getElementById('partner_candidate_id')?.value || '').trim(),
        __clear_family: (
          ((document.getElementById('relation').value||'').toUpperCase() === 'INDIVIDU')
          && (cand?.family_id || '').trim()
        ) ? '1' : '',
        address: (document.getElementById('address').value||'').trim(),
        docs_ktp: (cand?.docs_ktp || '').trim(),
        docs_kk: (cand?.docs_kk || '').trim(),
        docs_skck: (cand?.docs_skck || '').trim(),
        docs_health: (cand?.docs_health || '').trim(),
        photo_url: (cand?.photo_url || '').trim(),
      };

      const pidCtx = currentProgramId_();
      const r = await callOrQueue(
        () => callApi('upsertCandidate', Object.assign({ program_id: pidCtx }, payload)),
        'upsertCandidate',
        Object.assign({ program_id: pidCtx }, payload),
        'Simpan calon'
      );
      if(!r.ok) throw new Error(r.error||'Gagal');

      // update cache (optimistic)
      const merged = Object.assign({}, cand||{}, payload, { program_id: pidCtx });
      await cacheUpsert('candidates', { id: String(merged.candidate_id), data: merged }, { program_id: pidCtx });

      toast('Tersimpan', 'ok');

      // Jika create baru: tetap buka modal & aktifkan upload
      if (!cand?.candidate_id) {
        cand = Object.assign({}, merged, { candidate_id: r.candidate_id || localId });
        document.getElementById('uploadHint').textContent = 'Sekarang Anda bisa upload berkas.';
        Array.from(modal.querySelectorAll('input[type="file"]')).forEach(inp=>{ inp.disabled = false; });
        renderCandidates();
        return;
      }

      // ✅ FIX: tutup modal pakai close() (bukan overlay.remove())
      close();
      renderCandidates();

    }catch(e){
      toast(e.message,'error');
    }finally{
      btnBusy(btn,false,'Simpan');
    }
  };

  function f(label,id,ph){
    return h('div',{},[
      h('label',{class:'text-sm text-slate-600 dark:text-slate-300'},label),
      h('input',{id, placeholder:ph||'', class:'mt-1 w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500'})
    ]);
  }
  function val(id){ return (document.getElementById(id).value||'').trim(); }

    function fileBox_(label, field, isPhoto=false) {
    const id = 'file_' + field;
    const boxId = 'box_' + field;
    const stId  = 'st_' + field;

    const existingLink = (cand?.[field] || '').trim();

    const box = h('div',{
      id: boxId,
      class: 'rounded-2xl border border-slate-200 dark:border-slate-800 p-3 bg-white/60 dark:bg-slate-950/40 transition'
    },[
      h('div',{class:'text-xs font-medium mb-2 flex items-center justify-between'},[
        h('span',{}, label),
        h('span',{id: 'badge_'+field, class:'text-[10px] px-2 py-1 rounded-full border bg-slate-50 border-slate-200 text-slate-600 dark:bg-slate-900/40 dark:border-slate-800 dark:text-slate-300'}, existingLink ? 'TERUPLOAD' : 'BELUM')
      ]),
      h('input',{id, type:'file', accept: isPhoto ? 'image/*' : '*/*', class:'block w-full text-xs'},''),
      h('div',{id: stId, class:'mt-2 text-[11px] text-slate-500 dark:text-slate-400 break-all'}, 
        existingLink
          ? h('a',{href: existingLink, target:'_blank', rel:'noopener', class:'underline text-emerald-700 dark:text-emerald-300'}, 'Lihat dokumen')
          : 'Belum ada'
      )
    ]);

    // set initial "uploaded" style
    setTimeout(()=>{
      applyUploadedStyle_(field, existingLink);
    },0);

    // upload handler
    setTimeout(()=>{
      const inp = document.getElementById(id);
      if (!inp) return;

      inp.addEventListener('change', async ()=>{
        if (!cand?.candidate_id) return toast('Simpan calon dulu sebelum upload berkas', 'error');
        const f = inp.files && inp.files[0];
        if (!f) return;

        // UI: sedang upload
        setUploadingStyle_(field, true);

        try {
          const b64 = await fileToBase64_(f);
          const out = await callApiPost('uploadCandidateDoc', {
            candidate_id: cand.candidate_id,
            field,
            filename: f.name,
            mimeType: f.type || 'application/octet-stream',
            base64: b64,
            program_id: currentProgramId_()
          });
          if (!out.ok) throw new Error(out.error || 'Upload gagal');

          // simpan link ke object cand (agar ikut tersimpan saat klik Simpan)
          const link = String(out.url || out.file_url || out.file_link || out.file_id || '').trim();
          cand[field] = link;

          // update UI status + warna box
          applyUploadedStyle_(field, link);
          toast('Upload berhasil: ' + label, 'ok');

          // refresh list (optional)
          renderCandidates();

        } catch (e) {
          toast(e.message || 'Upload gagal', 'error');
          setUploadingStyle_(field, false);
        } finally {
          inp.value = '';
        }
      });
    },0);

    return box;
  }

  function setUploadingStyle_(field, uploading) {
    const box = document.getElementById('box_' + field);
    const badge = document.getElementById('badge_' + field);
    const st = document.getElementById('st_' + field);
    if (!box || !badge || !st) return;

    if (uploading) {
      box.classList.add('ring-2','ring-amber-400','bg-amber-50/60','dark:bg-amber-950/20');
      badge.textContent = 'MENGUPLOAD...';
      badge.className = 'text-[10px] px-2 py-1 rounded-full border bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/30 dark:border-amber-900 dark:text-amber-200';
      st.textContent = 'Sedang upload...';
    }
  }

  function applyUploadedStyle_(field, link) {
    const box = document.getElementById('box_' + field);
    const badge = document.getElementById('badge_' + field);
    const st = document.getElementById('st_' + field);
    if (!box || !badge || !st) return;

    const ok = !!String(link || '').trim();

    // reset classes
    box.classList.remove('ring-2','ring-amber-400','bg-amber-50/60','dark:bg-amber-950/20',
                         'ring-emerald-400','bg-emerald-50/60','dark:bg-emerald-950/20');

    if (ok) {
      box.classList.add('ring-2','ring-emerald-400','bg-emerald-50/60','dark:bg-emerald-950/20');
      badge.textContent = 'TERUPLOAD';
      badge.className = 'text-[10px] px-2 py-1 rounded-full border bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/30 dark:border-emerald-900 dark:text-emerald-200';
      st.innerHTML = '';
      st.appendChild(h('a',{href: link, target:'_blank', rel:'noopener', class:'underline text-emerald-700 dark:text-emerald-300'}, 'Lihat dokumen'));
    } else {
      badge.textContent = 'BELUM';
      badge.className = 'text-[10px] px-2 py-1 rounded-full border bg-slate-50 border-slate-200 text-slate-600 dark:bg-slate-900/40 dark:border-slate-800 dark:text-slate-300';
      st.textContent = 'Belum ada';
    }
  }
}

function fileToBase64_(file) {
  return new Promise((resolve, reject)=>{
    const reader = new FileReader();
    reader.onload = ()=>{
      const res = String(reader.result||'');
      // result = data:mime;base64,....
      const i = res.indexOf('base64,');
      resolve(i>=0 ? res.slice(i+7) : res);
    };
    reader.onerror = ()=>reject(new Error('Gagal membaca file'));
    reader.readAsDataURL(file);
  });
}


async function renderSelection() {
  if (String(currentProgramId_()||'') === '__ALL__') {
    toast('Silakan pilih program tertentu (bukan "Semua Program") untuk menu ini.', 'info');
    return renderDashboard();
  }

  const v = setViewTitle('Seleksi Lapangan', 'Input nilai fisik, uji panen, karakter & kategori A/B/C');
  const pid = currentProgramId_();

  const info = h('div',{class:'mb-3 text-xs text-slate-500 dark:text-slate-400'},'Memuat dari cache...');
  v.appendChild(info);

  const host = h('div',{},[
    card([ h('div',{class:'text-sm text-slate-500 dark:text-slate-400'},'Memuat...') ])
  ]);
  v.appendChild(host);

  const onUpdate = ({ items, from, meta, error, refreshing })=>{

      info.textContent = `Cache Seleksi: ${meta?.ts ? new Date(meta.ts).toLocaleString('id-ID') : '-'} • ${refreshing ? 'refresh...' : (from==='server' ? 'SERVER refresh' : 'CACHE only')}${error ? (' • Offline: ' + error) : ''}`;

      const rows = (items||[]).map(it=>[
        srcBadge_(rowSrc_(it), !!it.__local_pending),
        it.nik, it.name, badge(it.admin_status||'-'), badge(it.recommend_category||'-'), badge(it.final_category||'-'),
        h('button',{class:'rounded-xl px-3 py-2 text-xs bg-emerald-600 text-white', onclick:()=>openSelectionModal(it)}, 'Input/Update')
      ]);

      host.innerHTML = '';
      host.appendChild(card([ table(['SRC','NIK','Nama','Admin','Rekom','Final','Aksi'], rows) ]));
  };

// Local-first (work with legacy IndexedDB selection shape)
(async ()=>{
  const meta0 = await cacheMeta('selection');
  const cache0 = await selectionCacheForProgram_(pid);
  // tampilkan cache dulu
  try{
    onUpdate({ items: cache0.items, from:'cache', meta: meta0, error: (cache0.hasCandidateScope ? '' : 'Cache candidates kosong (scope program tidak bisa dipastikan)'), refreshing:true });
  }catch{}

  // refresh server
  setTimeout(async ()=>{
    try{
      const r = await callApi('listSelection', { program_id: pid });
      if(!(r && r.ok)) throw new Error(r?.error||'Gagal');
      const serverRows = (r.items||[]);
      // upsert per candidate_id (multi-program safe)
      for(const row0 of serverRows){
        const row = Object.assign({}, row0, { __src:'SERVER', __local_pending:false });
        await cacheUpsert('selection', { id: String(row.candidate_id||row.id||''), data: row }, { program_id: pid });
      }
      const meta1 = await cacheMeta('selection');
      const cache1 = await selectionCacheForProgram_(pid);
      if(state.viewKey !== 'selection') return;
      onUpdate({ items: cache1.items, from:'server', meta: meta1, error:'', refreshing:false });
    }catch(e){
      const meta1 = await cacheMeta('selection');
      const cache1 = await selectionCacheForProgram_(pid);
      if(state.viewKey !== 'selection') return;
      onUpdate({ items: cache1.items, from:'cache', meta: meta1||meta0, error:String(e?.message||e), refreshing:false });
    }
  },0);
})();
}



function openSelectionModal(it) {
  const { body, close } = openModal_({
    title: `Seleksi: ${it.name} (${it.nik})`,
    subtitle: 'Header tetap, isi bisa di-scroll.',
    maxWidth: 'max-w-3xl'
  });

  body.appendChild(h('div',{class:'grid md:grid-cols-3 gap-3'},[
    mini('Fisik','fisik', it.tes_fisik_score||''),
    mini('Uji Panen','panen', it.tes_panen_score||''),
    mini('Karakter','karakter', it.tes_karakter_score||''),
    h('div',{class:'md:col-span-3'},[
      h('label',{class:'text-sm text-slate-600 dark:text-slate-300'},'Catatan'),
      h('textarea',{id:'sel_notes', rows:'2', class:'mt-1 w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500'}, it.notes||'')
    ]),
    h('div',{class:'md:col-span-3 flex items-center gap-2'},[
      h('div',{class:'text-sm text-slate-500 dark:text-slate-400'},'Final kategori:'),
      selectCat(it.final_category||''),
    ])
  ]));

  body.appendChild(h('div',{class:'mt-5 flex justify-end gap-2'},[
    h('button',{class:'rounded-2xl px-4 py-2 text-sm border border-slate-200 dark:border-slate-800', onclick: close},'Batal'),
    h('button',{id:'btnSaveSel', class:'rounded-2xl px-4 py-2 text-sm bg-emerald-600 text-white hover:bg-emerald-700 flex items-center gap-2'},[
      h('span',{'data-spinner':'', class:'hidden w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin'}),
      h('span',{'data-label':'','data-orig':'Simpan'},'Simpan')
    ])
  ]));

  document.getElementById('btnSaveSel').onclick = async ()=>{
    const btn = document.getElementById('btnSaveSel');
    btnBusy(btn,true,'Menyimpan...');
    try{
      const payload = {
        candidate_id: it.candidate_id,
        tes_fisik_score: val('fisik'),
        tes_panen_score: val('panen'),
        tes_karakter_score: val('karakter'),
        final_category: (document.getElementById('final_cat').value||'').trim(),
        notes: (document.getElementById('sel_notes').value||'').trim()
      };
      const pid = currentProgramId_();
      const req = Object.assign({ program_id: pid }, payload);
      const r = await callOrQueue(() => callApi('submitSelection', req), 'submitSelection', req, 'Simpan seleksi');
      if(!r.ok) throw new Error(r.error||'Gagal');

      // optimistic cache update
      const merged = Object.assign({}, it, payload, { program_id: pid, __local_pending: !!r.queued, __src: (r.queued?'LOCAL':'SERVER') });
      await cacheUpsert('selection', { id: String(it.candidate_id), data: merged }, { program_id: pid });

      toast(r.queued ? 'Di-antrikan (offline). Nanti lakukan Sinkronisasi.' : 'Seleksi tersimpan', 'ok');
      close();
      renderSelection();
    }catch(e){
      toast(e.message,'error');
    }finally{
      btnBusy(btn,false,'Simpan');
    }
  };

  function mini(label,id,val0){
    return h('div',{},[
      h('label',{class:'text-sm text-slate-600 dark:text-slate-300'},label+' (0-100)'),
      h('input',{id, value:val0, class:'mt-1 w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500'})
    ]);
  }
  function val(id){ return (document.getElementById(id).value||'').trim(); }
  function selectCat(v0){
    const s = h('select',{id:'final_cat', class:'rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-sm'},[
      h('option',{value:''},'—'),
      h('option',{value:'A'},'A'),
      h('option',{value:'B'},'B'),
      h('option',{value:'C'},'C'),
    ]);
    s.value = v0 || '';
    return s;
  }
}


async function renderParticipants() {
  if (String(currentProgramId_()||'') === '__ALL__') {
    toast('Silakan pilih program tertentu (bukan "Semua Program") untuk menu ini.', 'info');
    return renderDashboard();
  }

  const v = setViewTitle('Peserta', 'Daftar peserta aktif (A/B) per program');
  const pid = currentProgramId_();
  const roleN = (String(state.user?.role||'').trim().toUpperCase()==='ADMINISTRATOR') ? 'ADMIN' : String(state.user?.role||'').trim().toUpperCase();
  const isAdmin = roleN === 'ADMIN';
  const isManager = roleN === 'MANAGER';
  const canManagePrograms = isAdmin || isManager;
  const canGenerate = (roleN==='ADMIN' || roleN==='MANAGER' || roleN==='KTU');
  const canPlace = (roleN==='ADMIN' || roleN==='MANAGER' || roleN==='ASISTEN');

  const info = h('div',{class:'mb-3 text-xs text-slate-500 dark:text-slate-400'},'Memuat dari cache...');
  v.appendChild(info);

  const top = h('div',{class:'flex gap-2 mb-4 flex-wrap'},[
    ...(canGenerate ? [h('button',{class:'rounded-2xl px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700 text-sm', onclick:async ()=>{
      const r = await callApi('generateParticipantsFromSelection', { program_id: currentProgramId_() });
      if (!r.ok) return toast(r.error||'Gagal', 'error');
      toast(`Generate selesai: +${r.created||0}`, 'ok');
      renderParticipants();
    }},'Generate dari Seleksi (A/B)')] : []),
    h('button',{class:'rounded-2xl px-4 py-2 border border-slate-200 dark:border-slate-800 text-sm', onclick:()=>renderParticipants()},'Refresh'),
  ]);
  v.appendChild(top);

  const host = h('div',{},[
    card([ h('div',{class:'text-sm text-slate-500 dark:text-slate-400'},'Memuat...') ])
  ]);
  v.appendChild(host);

  localFirstHydrateList_({
    store: 'participants',
    fetchFn: () => callApi('listParticipants', { program_id: pid }),
    filter: { program_id: pid },
    idKey: 'participant_id',
    serverPickKey: 'participants',
    viewToken: ()=> state.viewKey === 'participants',
    onUpdate: ({ items, from, meta, error, refreshing })=>{
      state.participants = items || [];
      info.textContent = `Cache Peserta: ${meta?.ts ? new Date(meta.ts).toLocaleString('id-ID') : '-'} • ${refreshing ? 'refresh...' : (from==='server' ? 'SERVER refresh' : 'CACHE only')}${error ? (' • Offline: ' + error) : ''}`;

      const rows = (state.participants||[]).map(p=>[
        srcBadge_(rowSrc_(p), !!p.__local_pending),
        p.nik, p.name, badge(p.category||'-'), badge(p.status||'-'), p.mentor_name || '-',
        (canPlace
          ? h('button',{class:'rounded-xl px-3 py-2 text-xs border border-slate-200 dark:border-slate-800', onclick:()=>openPlacementModal(p)},'Penempatan')
          : h('span',{class:'text-xs text-slate-500 dark:text-slate-400'},'-'))
      ]);

      host.innerHTML = '';
      host.appendChild(card([ table(['SRC','NIK','Nama','Cat','Status','Mentor','Aksi'], rows) ]));
    }
  });
}


function openPlacementModal(p) {
  const { body, close } = openModal_({
    title: `Penempatan: ${p.name}`,
    subtitle: 'Header tetap, isi bisa di-scroll.',
    maxWidth: 'max-w-2xl'
  });

  body.appendChild(h('div',{class:'grid md:grid-cols-3 gap-3'},[
    field('Estate','estate', p.estate||''),
    field('Divisi','divisi', p.divisi||''),
    field('Ancak','ancak', p.ancak||''),
  ]));

  body.appendChild(h('div',{class:'mt-5 flex justify-end gap-2'},[
    h('button',{class:'rounded-2xl px-4 py-2 text-sm border border-slate-200 dark:border-slate-800', onclick: close},'Batal'),
    h('button',{id:'btnSavePlace', class:'rounded-2xl px-4 py-2 text-sm bg-emerald-600 text-white hover:bg-emerald-700 flex items-center gap-2'},[
      h('span',{'data-spinner':'', class:'hidden w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin'}),
      h('span',{'data-label':'','data-orig':'Simpan'},'Simpan')
    ])
  ]));

  document.getElementById('btnSavePlace').onclick = async ()=>{
    const btn = document.getElementById('btnSavePlace');
    btnBusy(btn,true,'Menyimpan...');
    try{
      const payload = {
        participant_id: p.participant_id,
        estate: val('estate'),
        divisi: val('divisi'),
        ancak: val('ancak'),
      };
      const r = await callOrQueue(() => callApi('setPlacement', payload), 'setPlacement', payload, 'Penempatan');
      if(!r.ok) throw new Error(r.error||'Gagal');

      // optimistic cache
      const pidCtx = currentProgramId_();
      const merged = Object.assign({}, p, payload, { program_id: pidCtx, __local_pending: !!r.queued, __src: (r.queued?'LOCAL':'SERVER') });
      await cacheUpsert('participants', { id: String(p.participant_id), data: merged }, { program_id: pidCtx });
      toast('Penempatan tersimpan', 'ok');
      close();
      renderParticipants();
    }catch(e){ toast(e.message,'error'); }
    finally{ btnBusy(btn,false,'Simpan'); }
  };

  function field(label,id,v0){
    return h('div',{},[
      h('label',{class:'text-sm text-slate-600 dark:text-slate-300'},label),
      h('input',{id, value:v0||'', class:'mt-1 w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500'})
    ]);
  }
  function val(id){ return (document.getElementById(id).value||'').trim(); }
}


async function renderMentors() {
  if (String(currentProgramId_()||'') === '__ALL__') {
    toast('Silakan pilih program tertentu (bukan "Semua Program") untuk menu ini.', 'info');
    return renderDashboard();
  }

  const v = setViewTitle('Mentor & Pairing', 'Kelola mentor dan pairing 1-on-1 untuk peserta kategori B');
  const pid = currentProgramId_();
  const roleN = (String(state.user?.role||'').trim().toUpperCase()==='ADMINISTRATOR') ? 'ADMIN' : String(state.user?.role||'').trim().toUpperCase();
  const canEditMentor = (roleN==='ADMIN' || roleN==='MANAGER' || roleN==='ASISTEN');

  const info = h('div',{class:'mb-3 text-xs text-slate-500 dark:text-slate-400'},'Memuat dari cache...');
  v.appendChild(info);

  const top = h('div',{class:'flex flex-col md:flex-row md:items-center gap-2 mb-4'},[
    h('div',{class:'flex gap-2'},[
      ...(canEditMentor ? [h('button',{class:'rounded-2xl px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700 text-sm', onclick:()=>openMentorModal()},'Tambah Mentor')] : []),
      h('button',{class:'rounded-2xl px-4 py-2 border border-slate-200 dark:border-slate-800 text-sm', onclick:()=>renderMentors()},'Refresh'),
    ]),
    h('div',{class:'md:ml-auto text-xs text-slate-500 dark:text-slate-400'},'Tips: Pairing hanya untuk peserta kategori B.')
  ]);
  v.appendChild(top);

  const host = h('div',{class:'space-y-4'},[
    card([ h('div',{class:'text-sm text-slate-500 dark:text-slate-400'},'Memuat...') ])
  ]);
  v.appendChild(host);

  const renderUI = async ({ mentors, pairings, from, error, refreshing })=>{
    state.mentors = mentors || [];
    state.pairings = pairings || [];

    const mMeta = await cacheMeta('mentors');
    const pMeta = await cacheMeta('pairings');
    const tM = mMeta?.ts ? new Date(mMeta.ts).toLocaleString('id-ID') : '-';
    const tP = pMeta?.ts ? new Date(pMeta.ts).toLocaleString('id-ID') : '-';
    info.textContent = `Cache Mentor: ${tM} • Cache Pairing: ${tP} • ${refreshing ? 'refresh...' : (from==='server' ? 'SERVER refresh' : 'CACHE only')}${error ? (' • Offline: ' + error) : ''}`;

    const mentorRows = (state.mentors||[]).map(m=>[
      srcBadge_(rowSrc_(m), !!m.__local_pending),
      m.nik||'-',
      m.name||'-',
      badge((m.status||'ACTIVE').toUpperCase()),
      h('div',{class:'flex flex-wrap gap-2'},[
        h('button',{class:'rounded-xl px-3 py-2 text-xs border border-slate-200 dark:border-slate-800', onclick:()=>openMentorModal(m)},'Edit'),
              ])
    ]);

    const pairingRows = (state.pairings||[]).map(p=>[
      srcBadge_(rowSrc_(p), !!p.__local_pending),
      p.participant_nik||'-',
      p.participant_name||'-',
      badge(p.participant_category||'-'),
      p.mentor_name||'-',
      badge((p.status||'ACTIVE').toUpperCase()),
      h('div',{class:'flex flex-wrap gap-2'},[
        h('button',{class:'rounded-xl px-3 py-2 text-xs border border-slate-200 dark:border-slate-800', onclick:()=>openPairingModal(p)},'Detail'),
              ])
    ]);

    host.innerHTML = '';
    host.appendChild(card([
      h('div',{class:'flex items-center justify-between mb-3'},[
        h('div',{class:'text-sm font-semibold'},'Mentor'),
        (canEditMentor
          ? h('button',{class:'rounded-xl px-3 py-2 text-xs bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900', onclick:()=>openMentorModal()},'Tambah')
          : h('span',{class:'text-xs text-slate-500 dark:text-slate-400'},'')
        )
      ]),
      table(['SRC','NIK','Nama','Status','Aksi'], mentorRows)
    ]));

    host.appendChild(card([
      h('div',{class:'flex items-center justify-between mb-3'},[
        h('div',{class:'text-sm font-semibold'},'Pairing (Peserta B)'),
        h('button',{class:'rounded-xl px-3 py-2 text-xs bg-emerald-600 text-white', onclick:()=>openPairingModal(null)},'Tambah Pairing')
      ]),
      table(['SRC','NIK Peserta','Nama Peserta','Cat','Mentor','Status','Aksi'], pairingRows)
    ]));
  };

  // 1) render cache now
  const cachedMentors = await cacheGetAll('mentors', { program_id: pid });
  const cachedPairings = await cacheGetAll('pairings', { program_id: pid });
  await renderUI({ mentors: cachedMentors, pairings: cachedPairings, from:'cache', error:'', refreshing:true });

  // 2) background refresh
  setTimeout(async ()=>{
    try{
      const res = await callApi('listMentors', { program_id: pid });
      if (!res.ok) throw new Error(res.error||'Gagal');
      const serverMentors = (res.mentors||[]).map(x=>Object.assign({}, x, { __src:'SERVER', __local_pending:false }));
      const serverPairings = (res.pairings||[]).map(x=>Object.assign({}, x, { __src:'SERVER', __local_pending:false }));

      const mergedMentors = mergeLocalFirst_(cachedMentors, serverMentors, 'mentor_id');
      const mergedPairings = mergeLocalFirst_(cachedPairings, serverPairings, 'pairing_id');

      await cacheReplace('mentors', normalizeRows_(mergedMentors, 'mentor_id'), { program_id: pid });
      await cacheReplace('pairings', normalizeRows_(mergedPairings, 'pairing_id'), { program_id: pid });

      if (state.viewKey !== 'mentors') return;
      await renderUI({ mentors: mergedMentors, pairings: mergedPairings, from:'server', error:'', refreshing:false });
    } catch(e){
      if (state.viewKey !== 'mentors') return;
      await renderUI({ mentors: cachedMentors, pairings: cachedPairings, from:'cache', error:String(e?.message||e), refreshing:false });
    }
  }, 0);
}


// ======================
// MENTOR + PAIRING MODALS (standalone, reused by renderMentors)
// ======================
function openMentorModal(m=null){
  const pid = currentProgramId_();
  const { body, close } = openModal_({
    title: m ? 'Edit Mentor' : 'Tambah Mentor',
    subtitle: 'Simpan akan memakai local-first: cache tampil dulu, server menyusul.',
    maxWidth: 'max-w-3xl'
  });

  body.appendChild(h('div',{class:'grid md:grid-cols-3 gap-3'},[
    f('NIK','m_nik',''),
    f('Nama','m_name',''),
    f('Experience (tahun)','m_exp',''),
    f('Estate','m_estate', (state.myEstate||m?.estate||'').toUpperCase()),
    f('Divisi','m_divisi', m?.divisi||''),
    h('div',{class:'md:col-span-3'},[
      h('label',{class:'text-sm text-slate-600 dark:text-slate-300'},'Catatan'),
      h('textarea',{id:'m_notes', rows:'2', class:'mt-1 w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500'}, m?.notes||'')
    ])
  ]));

  // preset
  document.getElementById('m_nik').value = m?.nik||'';
  document.getElementById('m_name').value = m?.name||'';
  document.getElementById('m_exp').value = m?.experience_years||'';
  document.getElementById('m_estate').value = (m?.estate || state.myEstate || '').toUpperCase();
  document.getElementById('m_divisi').value = m?.divisi||'';

  body.appendChild(h('div',{class:'mt-5 flex justify-end gap-2'},[
    h('button',{class:'rounded-2xl px-4 py-2 text-sm border border-slate-200 dark:border-slate-800', onclick: close},'Batal'),
    h('button',{id:'btnSaveMentor', class:'rounded-2xl px-4 py-2 text-sm bg-emerald-600 text-white hover:bg-emerald-700 flex items-center gap-2'},[
      h('span',{'data-spinner':'', class:'hidden w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin'}),
      h('span',{'data-label':'','data-orig':'Simpan'},'Simpan')
    ])
  ]));

  document.getElementById('btnSaveMentor').onclick = async ()=>{
    const btn = document.getElementById('btnSaveMentor');
    btnBusy(btn,true,'Menyimpan...');
    try{
      const payload = {
        mentor_id: m?.mentor_id || '',
        program_id: pid,
        nik: (document.getElementById('m_nik').value||'').trim(),
        name: (document.getElementById('m_name').value||'').trim(),
        experience_years: (document.getElementById('m_exp').value||'').trim(),
        estate: (document.getElementById('m_estate').value||'').trim().toUpperCase(),
        divisi: (document.getElementById('m_divisi').value||'').trim(),
        notes: (document.getElementById('m_notes').value||'').trim(),
      };
      const r = await callOrQueue(() => callApi('upsertMentor', payload), 'upsertMentor', payload, 'Simpan mentor');
      if(!r.ok) throw new Error(r.error||'Gagal');

      // optimistic cache
      const id = String(r.mentor_id || payload.mentor_id || (crypto?.randomUUID ? crypto.randomUUID() : ('loc_'+Date.now())));
      const merged = Object.assign({}, m||{}, payload, { mentor_id:id, __local_pending: !!r.queued, __src: (r.queued?'LOCAL':'SERVER') });
      await cacheUpsert('mentors', { id, data: merged }, { program_id: pid });

      toast(r.queued ? 'Di-antrikan (offline). Nanti lakukan Sinkronisasi.' : 'Mentor tersimpan', 'ok');
      close();
      renderMentors();
    }catch(e){
      toast(e.message,'error');
    }finally{
      btnBusy(btn,false,'Simpan');
    }
  };
}

async function openPairingModal(p=null){
  const pid = currentProgramId_();
  const isDetail = !!p;

  // Lookup data (cache first)
  let parts = await cacheGetAll('participants', { program_id: pid });
  if (!parts.length) {
    try{
      const pr = await callApi('listParticipants', { program_id: pid });
      if (pr.ok) parts = pr.participants || [];
    }catch(e){}
  }
  parts = (parts||[]).filter(x => String(x.category||'').toUpperCase()==='B'); // only B

  let mentors = await cacheGetAll('mentors', { program_id: pid });
  if (!mentors.length) {
    try{
      const mr = await callApi('lookupMentors', { program_id: pid });
      if (mr.ok) mentors = mr.items || [];
    }catch(e){}
  }

  const { body, close } = openModal_({
    title: isDetail ? 'Detail Pairing' : 'Tambah Pairing',
    subtitle: isDetail ? 'Pairing aktif bersifat idempotent. Perubahan mentor memerlukan penutupan pairing lama (fitur belum dibuka).' : 'Pairing untuk peserta kategori B. Bisa auto-apply ke family (opsional).',
    maxWidth: 'max-w-3xl'
  });

  if (isDetail) {
    body.appendChild(card([
      table(['Field','Value'],[
        ['Peserta', `${p.participant_name||'-'} (${p.participant_nik||'-'})`],
        ['Mentor', `${p.mentor_name||'-'}`],
        ['Status', String(p.status||'').toUpperCase()||'-'],
        ['Start', p.start_date ? formatDateDMYID(p.start_date) : '-'],
        ['End', p.end_date ? formatDateDMYID(p.end_date) : '-'],
      ])
    ]));
    body.appendChild(h('div',{class:'mt-5 flex justify-end'},[
      h('button',{class:'rounded-2xl px-4 py-2 text-sm bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900', onclick: close},'Tutup')
    ]));
    return;
  }

  body.appendChild(h('div',{class:'grid md:grid-cols-3 gap-3'},[
    selectField('Peserta (B)','pair_participant',
      (parts||[]).map(x=>({ value:x.participant_id, label:`${x.nik||''} • ${x.name||''} • ${x.estate||''}/${x.divisi||''} • family:${x.family_id||'-'}` })),
      ''
    ),
    selectField('Mentor','pair_mentor',
      (mentors||[]).map(x=>({ value:x.mentor_id, label:`${x.nik||''} • ${x.name||''}` })),
      ''
    ),
    f('Start Date','pair_start', todayDMY()),
    h('div',{class:'md:col-span-3 flex items-center gap-2'},[
      h('input',{id:'pair_apply_family', type:'checkbox', checked:true}),
      h('label',{for:'pair_apply_family', class:'text-sm text-slate-600 dark:text-slate-300'},'Auto-apply ke Family ID yang sama (hanya peserta kategori B)')
    ])
  ]));

  body.appendChild(h('div',{class:'mt-5 flex justify-end gap-2'},[
    h('button',{class:'rounded-2xl px-4 py-2 text-sm border border-slate-200 dark:border-slate-800', onclick: close},'Batal'),
    h('button',{id:'btnSavePair', class:'rounded-2xl px-4 py-2 text-sm bg-emerald-600 text-white hover:bg-emerald-700 flex items-center gap-2'},[
      h('span',{'data-spinner':'', class:'hidden w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin'}),
      h('span',{'data-label':'','data-orig':'Simpan'},'Simpan')
    ])
  ]));

  document.getElementById('btnSavePair').onclick = async ()=>{
    const btn = document.getElementById('btnSavePair');
    btnBusy(btn,true,'Menyimpan...');
    try{
      const participant_id = (document.getElementById('pair_participant').value||'').trim();
      const mentor_id = (document.getElementById('pair_mentor').value||'').trim();
      const startDisp = (document.getElementById('pair_start').value||'').trim();
      const start_date = dmyToISO(startDisp);
      if(!participant_id || !mentor_id) throw new Error('Peserta & Mentor wajib');
      if(!start_date) throw new Error('Start Date harus dd-mm-yyyy');

      const payload = {
        program_id: pid,
        participant_id,
        mentor_id,
        start_date,
        apply_family: document.getElementById('pair_apply_family').checked ? 'TRUE' : 'FALSE'
      };

      const r = await callOrQueue(() => callApi('assignMentor', payload), 'assignMentor', payload, 'Assign mentor');
      if(!r.ok) throw new Error(r.error||'Gagal');

      toast(r.queued ? 'Di-antrikan (offline). Nanti lakukan Sinkronisasi.' : 'Pairing tersimpan', 'ok');
      close();
      renderMentors();
    }catch(e){
      toast(e.message,'error');
    }finally{
      btnBusy(btn,false,'Simpan');
    }
  };
}



async function renderMonitoring(){
  if (String(currentProgramId_()||'') === '__ALL__') {
    toast('Silakan pilih program tertentu (bukan "Semua Program") untuk menu ini.', 'info');
    return renderDashboard();
  }

  const v = setViewTitle('Monitoring Harian', 'Input log harian (mandor/mentor/asisten) dan lihat rekap cepat');
  const today = todayDMY();

  const top = h('div',{class:'grid md:grid-cols-4 gap-3 mb-4'},[
    h('div',{},[
      h('label',{class:'text-sm text-slate-600 dark:text-slate-300'},'Tanggal'),
      h('input',{id:'mon_date', value:today, placeholder:'dd-mm-yyyy', inputmode:'numeric', class:'mt-1 w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-3 text-sm'})
    ]),
    h('div',{},[
      h('label',{class:'text-sm text-slate-600 dark:text-slate-300'},'Peserta'),
      h('input',{id:'mon_q', placeholder:'cari nama/nik', class:'mt-1 w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-3 text-sm'})
    ]),
    h('div',{class:'flex items-end gap-2'},[
      h('button',{class:'rounded-2xl px-4 py-3 bg-emerald-600 text-white hover:bg-emerald-700 text-sm', onclick:()=>loadLogs()},'Load'),
      h('button',{class:'rounded-2xl px-4 py-3 border border-slate-200 dark:border-slate-800 text-sm', onclick:()=>openDailyLogModal()},'Input Log')
    ]),
    h('div',{class:'flex items-end'},[
      h('button',{class:'w-full rounded-2xl px-4 py-3 border border-slate-200 dark:border-slate-800 text-sm', onclick:async ()=>{
        const dDisp = (document.getElementById('mon_date').value||'').trim();
        const d = dmyToISO(dDisp);
        if(!d) return toast('Format tanggal harus dd-mm-yyyy', 'error');
        const pid = currentProgramId_();
        const payload = { program_id: pid, any_date: d };
        const r = await callOrQueue(() => callApi('computeWeeklyRecap', payload), 'computeWeeklyRecap', payload, 'Hitung rekap mingguan');
        if(!r.ok) return toast(r.error||'Gagal', 'error');
        toast(r.queued ? 'Di-antrikan (offline). Nanti lakukan Sinkronisasi.' : 'Rekap mingguan dihitung/diupdate', r.queued ? 'info' : 'ok');
        // refresh view
        await loadWeeklyRecaps();
      }},'Hitung Rekap Mingguan')
    ])
  ]);
  v.appendChild(top);

  const meta = await cacheMeta('daily_logs');
  v.appendChild(cacheInfoLine_('DailyLogs', meta, ''));

  const holder = h('div',{id:'mon_holder'},[]);
  v.appendChild(card([holder]));

  // Weekly recap section
  const recapMeta = await cacheMeta('weekly_recaps');
  v.appendChild(cacheInfoLine_('WeeklyRecaps', recapMeta, ''));
  const recapHolder = h('div',{id:'mon_weekly_holder'},[]);
  v.appendChild(card([
    h('div',{class:'flex items-center justify-between mb-2'},[
      h('div',{class:'font-semibold'},'Rekap Mingguan (berdasarkan tanggal yang dipilih)'),
      h('div',{class:'flex items-center gap-3'},[
        h('label',{class:'flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer select-none'},[
          h('input',{id:'mon_weekly_all', type:'checkbox', class:'rounded', onchange:()=>loadWeeklyRecaps()}),
          h('span',{},'Tampilkan semua peserta (0% jika belum ada log)')
        ]),
        h('div',{id:'mon_weekly_range', class:'text-xs text-slate-500 dark:text-slate-400'},'')
      ])
    ]),
    recapHolder
  ]));

  function keyFor_(x){
    // pastikan ada id stabil untuk cache
    const pid = String(x.participant_id||'');
    const dt  = String(x.date||'');
    return (x.log_id ? String(x.log_id) : (pid && dt ? (pid+'|'+dt) : ('log_'+Math.random().toString(36).slice(2))));
  }

  function renderTable_(items){
    holder.innerHTML='';
    if (!items.length) {
      holder.appendChild(h('div',{class:'text-sm text-slate-500 dark:text-slate-400'}, 'Tidak ada log untuk filter ini.'));
      return;
    }
    holder.appendChild(table(['SRC','Tanggal','Peserta','Ton','Mutu','APD','Disiplin','Catatan'], items.map(x=>[
      srcBadge_(rowSrc_(x), !!x.__local_pending),
      isoToDMY(x.date),
      `${x.participant_name} (${x.participant_nik})`,
      x.tonnage||'-',
      x.mutu_grade||'-',
      badge(x.apd_ok||'-'),
      x.discipline_score||'-',
      (x.note || x.mentor_note || x.mandor_note || x.assistant_note || '') || '-'
    ])));
  }

  function renderWeeklyTable_(items, rangeText=''){
    const rEl = document.getElementById('mon_weekly_range');
    if (rEl) rEl.textContent = rangeText || '';
    recapHolder.innerHTML='';
    if (!items || !items.length) {
      recapHolder.appendChild(h('div',{class:'text-sm text-slate-500 dark:text-slate-400'}, 'Belum ada rekap untuk minggu ini. Klik "Hitung Rekap Mingguan".'));
      return;
    }
    recapHolder.appendChild(table(
      ['SRC','Peserta','Avg Ton','Avg Mutu','Losses','Hadir%','APD%','Disiplin','Reviewed'],
      items.map(x=>[
        srcBadge_(rowSrc_(x), !!x.__local_pending),
        `${x.participant_name || ''} (${x.participant_nik || ''})`,
        x.avg_tonnage || '-',
        x.avg_mutu || '-',
        x.losses_rate || '-',
        x.attendance_pct || '-',
        x.apd_pct || '-',
        x.discipline_avg || '-',
        x.reviewed_at ? formatDateLongID(x.reviewed_at) : '-'
      ])
    ));
  }

  async function loadWeeklyRecaps(){
    const dDisp = (document.getElementById('mon_date').value||'').trim();
    const dateIso = dmyToISO(dDisp);
    if(!dateIso) return;
    const pid = currentProgramId_();
    const includeAll = !!document.getElementById('mon_weekly_all')?.checked;

    // 1) cache first
    let raw = [];
    try { raw = await cacheGetAllRaw('weekly_recaps'); } catch(e){ raw = []; }
    const cached = (raw||[])
      .map(r => (r && r.data) ? r.data : r)
      .filter(x => String(x.program_id||'')===String(pid) && String(x.week_start||'') && String(x.week_end||''))
      // show only the week containing dateIso
      .filter(x => String(x.week_start||'') <= String(dateIso) && String(x.week_end||'') >= String(dateIso))
      .map(x => Object.assign({}, x, { __src: x.__src || 'CACHE' }));

    const rangeTextCached = cached.length ? `Periode: ${isoToDMY(cached[0].week_start)} s/d ${isoToDMY(cached[0].week_end)}` : '';
    renderWeeklyTable_(cached, rangeTextCached);

    // 2) server refresh
    try{
      const r = await callApi('listWeeklyRecaps', { program_id: pid, any_date: dateIso, include_all: includeAll ? '1' : '0' });
      if(!r.ok) throw new Error(r.error||'Gagal');
      const items = (r.items||[]).map(x => Object.assign({}, x, { program_id: pid, __src:'SERVER', __local_pending:false }));
      const rangeText = `Periode: ${isoToDMY(r.week_start)} s/d ${isoToDMY(r.week_end)}`;

      // cache upsert
      for (const row of items) {
        const id = String(row.recap_id || (String(row.participant_id||'')+'|'+String(row.week_start||'')));
        if (!id) continue;
        await cacheUpsert('weekly_recaps', { id, data: row }, { program_id: pid, week_start: r.week_start, week_end: r.week_end });
      }
      renderWeeklyTable_(items, rangeText);
    } catch(e){
      // stay with cache
    }
  }

// ======================
// FIX: Normalize date from cache/server (Date string -> YYYY-MM-DD)
// ======================
function toISODate_(v){
  const s = String(v || '').trim();
  if (!s) return '';
  // already ISO date
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // try parse Date string (e.g. "Sat Feb 21 2026 00:00:00 GMT+0700 ...")
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    // local date (WIB) -> YYYY-MM-DD
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2,'0');
    const dd = String(d.getDate()).padStart(2,'0');
    return `${yyyy}-${mm}-${dd}`;
  }

  // maybe dd-mm-yyyy
  const iso = dmyToISO(s);
  if (iso) return iso;

  return '';
}

function normalizeDailyLogRow_(x){
  const row = Object.assign({}, x || {});
  row.date = toISODate_(row.date);
  // kadang note disimpan ke mentor_note/mandor_note, keep as is
  row.__src = row.__local_pending ? 'LOCAL' : (row.__src || 'CACHE');
  return row;
}

async function loadLogs(){
  const dDisp = (document.getElementById('mon_date').value||'').trim();
  const dateIso = dmyToISO(dDisp);
  if(!dateIso) return toast('Format tanggal harus dd-mm-yyyy', 'error');

  const qDisp = (document.getElementById('mon_q').value||'').trim();
  const q = qDisp.toLowerCase();
  const pid = currentProgramId_();

  // 1) CACHE dulu (IndexedDB) -> normalize date dulu baru filter
  let raw = [];
  try { raw = await cacheGetAllRaw('daily_logs'); } catch(e){ raw = []; }

  const cached = (raw||[])
    .map(r => (r && r.data) ? r.data : r)
    .map(normalizeDailyLogRow_)
    .filter(x => String(x.program_id||'')===String(pid) && String(x.date||'')===String(dateIso))
    .filter(x => {
      if (!q) return true;
      const nm = String(x.participant_name||'').toLowerCase();
      const nk = String(x.participant_nik||x.nik||'').toLowerCase();
      return nm.includes(q) || nk.includes(q);
    });

  renderTable_(cached);
  // load weekly recap too
  try { await loadWeeklyRecaps(); } catch(e) {}

  // 2) SERVER refresh -> normalize date juga, lalu merge, lalu cache
  try{
    const r = await callApi('getDailyLogs', { program_id: pid, date: dateIso, q: qDisp });
    if(!r.ok) throw new Error(r.error||'Gagal');

    const serverRows = (r.logs || []);
    const server = (serverRows||[])
      .map(x => Object.assign({}, x, {
        program_id: pid,
        __src: 'SERVER',
        __local_pending: false
      }))
      .map(normalizeDailyLogRow_)
      .filter(x => x.date); // pastikan date valid

    // merge: pertahankan LOCAL pending jika ada
    function keyFlex_(x){
      const a = String(x?.log_id||'').trim();
      if (a) return a;

      const pid2 = String(x?.participant_id||'').trim();
      const dt2  = String(toISODate_(x?.date)||'').trim(); // normalize date for key
      return (pid2 && dt2) ? (pid2 + '|' + dt2) : '';
    }

    const cached2 = (cached||[])
      .map(x => Object.assign({}, x, { __merge_id: keyFlex_(x) }))
      .filter(x=>x.__merge_id);

    const server2 = (server||[])
      .map(x => Object.assign({}, x, { __merge_id: keyFlex_(x) }))
      .filter(x=>x.__merge_id);

    const merged = mergeLocalFirst_(cached2, server2, '__merge_id');

    // upsert semua merged ke IndexedDB (id = log_id kalau ada; fallback merge key)
    for (const row of merged) {
      const id = String(row.log_id || row.__merge_id || '');
      if (!id) continue;
      const clean = Object.assign({}, row);
      delete clean.__merge_id;
      // FIX: simpan date sudah ISO
      clean.date = toISODate_(clean.date);
      await cacheUpsert('daily_logs', { id, data: clean }, { program_id: pid });
    }

    renderTable_(merged.map(x=>{
      const y = Object.assign({}, x);
      y.date = toISODate_(y.date);
      return y;
    }));

  } catch(e){
    toast('Offline: ' + (e.message||e), 'info');
  }
}
}
async function openDailyLogModal() {
  // Load dropdown data
  let parts = [];
  let mentors = [];
  // cache first
  try {
    const pid = currentProgramId_();
    parts = await cacheGetAll('participants', { program_id: pid });
    mentors = await cacheGetAll('mentors', { program_id: pid });
    if (state.user?.role==='MENTOR') parts = (parts||[]).filter(x=>String(x.category||'').toUpperCase()==='B');
  } catch(e) {}

  try {
    const pid = currentProgramId_();
    const pr = await callApi('lookupParticipants', (state.user?.role==='MENTOR') ? { program_id: pid, category:'B' } : { program_id: pid });
    if (pr.ok) parts = pr.items||[];
    const mr = await callApi('lookupMentors', { program_id: pid });
    if (mr.ok) mentors = mr.items||[];
  } catch (e) {}

  const { body, close } = openModal_({
    title: 'Input Log Harian',
    subtitle: 'Header tetap, isi form bisa di-scroll.',
    maxWidth: 'max-w-3xl'
  });

  body.appendChild(h('div',{class:'grid md:grid-cols-2 gap-3'},[
    h('div',{},[
      h('label',{class:'text-sm text-slate-600 dark:text-slate-300'},'Peserta'),
      h('select',{id:'dl_participant', class:'mt-1 w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-3 text-sm'},[
        h('option',{value:''},'-- Pilih Peserta --')
      ]),
      h('div',{class:'text-xs text-slate-500 dark:text-slate-400 mt-1'},'Data peserta diambil dari program aktif')
    ]),
    h('div',{},[
      h('label',{class:'text-sm text-slate-600 dark:text-slate-300'},'Tanggal'),
      h('input',{id:'dl_date', value:todayDMY(), placeholder:'dd-mm-yyyy', inputmode:'numeric', class:'mt-1 w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-3 text-sm'})
    ]),
    h('div',{},[
      h('label',{class:'text-sm text-slate-600 dark:text-slate-300'},'Mentor (otomatis dari pairing jika ada)'),
      h('select',{id:'dl_mentor', class:'mt-1 w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-3 text-sm'},[
        h('option',{value:''},'-- Auto / Pilih Mentor --')
      ])
    ]),
    field2('Attendance','dl_att','HADIR'),
    field2('Tonnage (ton/HK)','dl_ton','1.0'),
    field2('Mutu/Grading','dl_mutu',''),
    field2('Losses/Brondolan','dl_loss',''),
    h('div',{},[
      h('label',{class:'text-sm text-slate-600 dark:text-slate-300'},'APD OK'),
      h('select',{id:'dl_apd', class:'mt-1 w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-3 text-sm'},[
        h('option',{value:'TRUE'},'TRUE'),
        h('option',{value:'FALSE'},'FALSE'),
      ])
    ]),
    field2('Disiplin (0-100)','dl_dis','80'),
    h('div',{class:'md:col-span-2'},[
      h('label',{class:'text-sm text-slate-600 dark:text-slate-300'},'Catatan'),
      h('textarea',{id:'dl_note', rows:'2', class:'mt-1 w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-3 text-sm'}, '')
    ]),
  ]));

  body.appendChild(h('div',{class:'mt-5 flex justify-end gap-2'},[
    h('button',{class:'rounded-2xl px-4 py-2 text-sm border border-slate-200 dark:border-slate-800', onclick: close},'Batal'),
    h('button',{id:'btnSaveDL', class:'rounded-2xl px-4 py-2 text-sm bg-emerald-600 text-white hover:bg-emerald-700 flex items-center gap-2'},[
      h('span',{'data-spinner':'', class:'hidden w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin'}),
      h('span',{'data-label':'','data-orig':'Simpan'},'Simpan')
    ])
  ]));

  // Populate dropdowns
  const selP = document.getElementById('dl_participant');
  const selM = document.getElementById('dl_mentor');
  if (selP) {
    parts.forEach(x => {
      const label = `${x.name||'-'} (${x.nik||''})${x.category?(' • '+x.category):''}`;
      selP.appendChild(h('option', { value:x.participant_id }, label));
    });
    selP.addEventListener('change', async () => {
      const pid = selP.value;
      if (!pid) return;
      try {
        const rr = await callApi('getParticipantMentor', { participant_id: pid });
        if (rr.ok && rr.mentor && selM) selM.value = rr.mentor.mentor_id || '';
      } catch (e) {}
    });
  }
  if (selM) {
    mentors.forEach(x => {
      const label = `${x.name||'-'} (${x.nik||''})`;
      selM.appendChild(h('option', { value:x.mentor_id }, label));
    });
  }

  document.getElementById('btnSaveDL').onclick = async ()=>{
    const btn = document.getElementById('btnSaveDL');
    btnBusy(btn,true,'Menyimpan...');
    try{
      const dateIso = dmyToISO(v('dl_date'));
      if(!dateIso) throw new Error('Format tanggal harus dd-mm-yyyy');
      const payload = {
        program_id: currentProgramId_(),
        participant_id: v('dl_participant'),
        mentor_id: v('dl_mentor'),
        date: dateIso, // ✅ pastikan ISO dari awal
        attendance: v('dl_att'),
        tonnage: v('dl_ton'),
        mutu_grade: v('dl_mutu'),
        losses_brondolan: v('dl_loss'),
        apd_ok: v('dl_apd'),
        discipline_score: v('dl_dis'),
        note: (document.getElementById('dl_note').value||'').trim()
      };

      // ✅ buat payload2 dulu baru dipakai
      const log_id = (crypto?.randomUUID ? crypto.randomUUID() : ('log_' + Date.now() + '_' + Math.random().toString(36).slice(2)));
      const payload2 = Object.assign({ log_id }, payload);

      const r = await callOrQueue(() => callApi('submitDailyLog', payload2), 'submitDailyLog', payload2, 'Simpan daily log');
      if(!r.ok) throw new Error(r.error||'Gagal');

      // optimistic cache update
      const pidCtx = currentProgramId_();
      await cacheUpsert(
        'daily_logs',
        {
          id: String(log_id),
          data: Object.assign(
            {
              log_id,
              program_id: pidCtx,
              date: dateIso,   
              __local_pending: !!r.queued,
              __src: (r.queued ? 'LOCAL' : 'SERVER')
            },
            payload2
          )
        },
        { program_id: pidCtx }
      );
      toast(r.queued ? 'Di-antrikan (offline). Nanti lakukan Sinkronisasi.' : 'Log tersimpan', 'ok');
      close();
    }catch(e){ toast(e.message,'error'); }
    finally{ btnBusy(btn,false,'Simpan'); }
  };

  function field2(label,id,ph){
    return h('div',{},[
      h('label',{class:'text-sm text-slate-600 dark:text-slate-300'},label),
      h('input',{id, placeholder:ph||'', class:'mt-1 w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-3 text-sm'})
    ]);
  }
  function v(id){ return (document.getElementById(id).value||'').trim(); }
}


async function renderGraduation() {
  if (String(currentProgramId_()||'') === '__ALL__') {
    toast('Silakan pilih program tertentu (bukan "Semua Program") untuk menu ini.', 'info');
    return renderDashboard();
  }

  const v = setViewTitle('Kelulusan', 'Set keputusan LULUS / TIDAK LULUS berdasarkan monitoring');
  const pid = currentProgramId_();

  const info = h('div',{class:'mb-3 text-xs text-slate-500 dark:text-slate-400'},'Memuat dari cache...');
  v.appendChild(info);

  // ===== Rekap Bulanan =====
  const now = new Date();
  const monthDefault = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const monthTop = h('div',{class:'grid md:grid-cols-4 gap-3 mb-3'},[
    h('div',{},[
      h('label',{class:'text-sm text-slate-600 dark:text-slate-300'},'Bulan (Rekap Bulanan)'),
      h('input',{id:'grad_month', type:'month', value: monthDefault, class:'mt-1 w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-3 text-sm'})
    ]),
    h('div',{class:'flex items-end gap-2'},[
      h('button',{class:'rounded-2xl px-4 py-3 bg-emerald-600 text-white hover:bg-emerald-700 text-sm', onclick:()=>loadMonthlyRecap()},'Muat Rekap Bulanan'),
      h('button',{class:'rounded-2xl px-4 py-3 border border-slate-200 dark:border-slate-800 text-sm', onclick:()=>loadFinalRecap()},'Muat Rekap Akhir Program')
    ]),
    h('div',{class:'md:col-span-2 flex items-end'},[
      h('div',{id:'grad_period', class:'text-xs text-slate-500 dark:text-slate-400'},'')
    ])
  ]);
  v.appendChild(monthTop);

  const monthlyInfo = h('div',{class:'mb-2 text-xs text-slate-500 dark:text-slate-400'},'Rekap bulanan: memuat...');
  v.appendChild(monthlyInfo);
  const monthlyHolder = h('div',{},[card([h('div',{class:'text-sm text-slate-500 dark:text-slate-400'},'Memuat...')])]);
  v.appendChild(monthlyHolder);

  const finalInfo = h('div',{class:'mt-4 mb-2 text-xs text-slate-500 dark:text-slate-400'},'Rekap akhir program: memuat...');
  v.appendChild(finalInfo);
  const finalHolder = h('div',{},[card([h('div',{class:'text-sm text-slate-500 dark:text-slate-400'},'Memuat...')])]);
  v.appendChild(finalHolder);

  const host = h('div',{},[
    card([ h('div',{class:'text-sm text-slate-500 dark:text-slate-400'},'Memuat...') ])
  ]);
  v.appendChild(host);

  function monthAnyDate_(){
    const m = String(document.getElementById('grad_month')?.value||'').trim();
    if(!m) return '';
    // gunakan tanggal 15 agar aman
    return `${m}-15`;
  }

  function renderMonthly_(items, rangeText){
    monthlyHolder.innerHTML='';
    if (!items || !items.length) {
      monthlyHolder.appendChild(card([h('div',{class:'text-sm text-slate-500 dark:text-slate-400'},'Tidak ada data rekap bulanan (atau belum ada log).') ]));
      return;
    }
    monthlyHolder.appendChild(card([
      h('div',{class:'flex items-center justify-between mb-2'},[
        h('div',{class:'font-semibold'},'Rekap Bulanan'),
        h('div',{class:'text-xs text-slate-500 dark:text-slate-400'}, rangeText||'')
      ]),
      table(['SRC','Peserta','Total Log','Avg Ton','Avg Mutu','Losses','Hadir%','APD%','Disiplin'],
        items.map(x=>[
          srcBadge_(rowSrc_(x), !!x.__local_pending),
          `${x.participant_name||''} (${x.participant_nik||''})`,
          x.total_logs||'0',
          x.avg_tonnage||'-',
          x.avg_mutu||'-',
          x.losses_rate||'-',
          x.attendance_pct||'0',
          x.apd_pct||'0',
          x.discipline_avg||'-'
        ])
      )
    ]));
  }

  function renderFinal_(items, rangeText){
    finalHolder.innerHTML='';
    if (!items || !items.length) {
      finalHolder.appendChild(card([h('div',{class:'text-sm text-slate-500 dark:text-slate-400'},'Tidak ada peserta pada program ini.') ]));
      return;
    }
    finalHolder.appendChild(card([
      h('div',{class:'flex items-center justify-between mb-2'},[
        h('div',{class:'font-semibold'},'Rekap Akhir Program'),
        h('div',{class:'text-xs text-slate-500 dark:text-slate-400'}, rangeText||'')
      ]),
      table(['SRC','Peserta','Total Log','Avg Ton','Avg Mutu','Losses','Hadir%','APD%','Disiplin','Rekom','Keputusan','Aksi'],
        items.map(x=>[
          srcBadge_(rowSrc_(x), !!x.__local_pending),
          `${x.participant_name||''} (${x.participant_nik||''})`,
          x.total_logs||'0',
          x.avg_tonnage||'-',
          x.avg_mutu||'-',
          x.losses_rate||'-',
          x.attendance_pct||'0',
          x.apd_pct||'0',
          x.discipline_avg||'-',
          badge(x.recommended||'-'),
          badge(x.decision||'-'),
          h('button',{class:'rounded-xl px-3 py-2 text-xs bg-emerald-600 text-white', onclick:()=>openGradModal({
            participant_id: x.participant_id,
            nik: x.participant_nik,
            name: x.participant_name,
            status: x.status||''
          })},'Putuskan')
        ])
      )
    ]));
  }

  async function loadMonthlyRecap(){
    const anyDate = monthAnyDate_();
    if(!anyDate) return toast('Pilih bulan dulu','error');

    // cache first
    let raw = [];
    try { raw = await cacheGetAllRaw('monthly_recaps'); } catch(e){ raw = []; }
    const cached = (raw||[])
      .map(r => (r && r.data) ? r.data : r)
      .filter(x => String(x.program_id||'')===String(pid) && String(x.month||'')===String(anyDate).slice(0,7))
      .map(x => Object.assign({}, x, { __src: x.__src || 'CACHE' }));
    const rangeCached = cached.length ? `Periode: ${isoToDMY(cached[0].month_start)} s/d ${isoToDMY(cached[0].month_end)}` : '';
    renderMonthly_(cached, rangeCached);

    // server refresh
    try{
      const r = await callApi('listMonthlyRecaps', { program_id: pid, any_date: anyDate, include_all:'1' });
      if(!r.ok) throw new Error(r.error||'Gagal');
      const items = (r.items||[]).map(x => Object.assign({}, x, { program_id: pid, __src:'SERVER', __local_pending:false }));
      const rangeText = `Periode: ${isoToDMY(r.month_start)} s/d ${isoToDMY(r.month_end)}`;
      for (const row of items) {
        const id = String(row.recap_id || (String(row.participant_id||'')+'|'+String(row.month||'')));
        if (!id) continue;
        await cacheUpsert('monthly_recaps', { id, data: row }, { program_id: pid, month: r.month });
      }
      renderMonthly_(items, rangeText);
      monthlyInfo.textContent = `Rekap bulanan: SERVER • ${items.length} baris`;
    }catch(e){
      monthlyInfo.textContent = `Rekap bulanan: CACHE (offline)${cached.length ? '' : ' • (belum ada cache)'} `;
    }
  }

  async function loadFinalRecap(){
    // cache first
    let raw = [];
    try { raw = await cacheGetAllRaw('final_recaps'); } catch(e){ raw = []; }
    const cached = (raw||[])
      .map(r => (r && r.data) ? r.data : r)
      .filter(x => String(x.program_id||'')===String(pid))
      .map(x => Object.assign({}, x, { __src: x.__src || 'CACHE' }));
    const rangeCached = cached.length ? `Periode: ${isoToDMY(cached[0].period_start)} s/d ${isoToDMY(cached[0].period_end)}` : '';
    renderFinal_(cached, rangeCached);

    // server refresh
    try{
      const r = await callApi('listFinalRecap', { program_id: pid });
      if(!r.ok) throw new Error(r.error||'Gagal');
      const items = (r.items||[]).map(x => Object.assign({}, x, { program_id: pid, __src:'SERVER', __local_pending:false }));
      const rangeText = `Periode: ${isoToDMY(r.period_start)} s/d ${isoToDMY(r.period_end)}`;
      const pEl = document.getElementById('grad_period');
      if (pEl) pEl.textContent = rangeText;
      for (const row of items) {
        const id = String(row.participant_id||'');
        if (!id) continue;
        await cacheUpsert('final_recaps', { id, data: row }, { program_id: pid, period_start: r.period_start, period_end: r.period_end });
      }
      renderFinal_(items, rangeText);
      finalInfo.textContent = `Rekap akhir program: SERVER • ${items.length} baris`;
    }catch(e){
      finalInfo.textContent = `Rekap akhir program: CACHE (offline)${cached.length ? '' : ' • (belum ada cache)'}`;
    }
  }

  localFirstHydrateList_({
    store:'graduations',
    fetchFn: ()=> callApi('listGraduation', {}),
    filter:{ program_id: pid },
    idKey:'participant_id',
    serverPickKey:'items',
    viewToken: ()=> state.viewKey === 'graduation',
    onUpdate: ({ items, from, meta, error, refreshing })=>{
      info.textContent = `Cache Kelulusan: ${meta?.ts ? new Date(meta.ts).toLocaleString('id-ID') : '-'} • ${refreshing ? 'refresh...' : (from==='server' ? 'SERVER refresh' : 'CACHE only')}${error ? (' • Offline: ' + error) : ''}`;
      const rows = (items||[]).map(it=>[
        srcBadge_(rowSrc_(it), !!it.__local_pending),
        `${it.name} (${it.nik})`,
        badge(it.status||'-'),
        badge(it.decision||'-'),
        h('button',{class:'rounded-xl px-3 py-2 text-xs bg-emerald-600 text-white', onclick:()=>openGradModal(it)},'Putuskan')
      ]);
      host.innerHTML='';
      host.appendChild(card([ table(['SRC','Peserta','Status','Keputusan','Aksi'], rows) ]));
    }
  });

  // initial load
  try { await loadMonthlyRecap(); } catch(e){}
  try { await loadFinalRecap(); } catch(e){}
}


function openGradModal(it){
  const overlay = h('div', { class:'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40' }, []);
  const modal = card([
    h('div',{class:'text-lg font-semibold'},`Kelulusan: ${it.name}`),
    h('div',{class:'mt-4 grid md:grid-cols-2 gap-3'},[
      h('div',{},[
        h('label',{class:'text-sm text-slate-600 dark:text-slate-300'},'Keputusan'),
        h('select',{id:'g_dec', class:'mt-1 w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-3 text-sm'},[
          h('option',{value:'LULUS'},'LULUS'),
          h('option',{value:'TIDAK_LULUS'},'TIDAK_LULUS'),
        ])
      ]),
      h('div',{},[
        h('label',{class:'text-sm text-slate-600 dark:text-slate-300'},'Alasan (wajib jika tidak lulus)'),
        h('input',{id:'g_reason', placeholder:'contoh: tidak disiplin / tidak berkembang', class:'mt-1 w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-3 text-sm'})
      ]),
    ]),
    h('div',{class:'mt-5 flex justify-end gap-2'},[
      h('button',{class:'rounded-2xl px-4 py-2 text-sm border border-slate-200 dark:border-slate-800', onclick:()=>overlay.remove()},'Batal'),
      h('button',{id:'btnSaveGrad', class:'rounded-2xl px-4 py-2 text-sm bg-emerald-600 text-white hover:bg-emerald-700 flex items-center gap-2'},[
        h('span',{'data-spinner':'', class:'hidden w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin'}),
        h('span',{'data-label':'','data-orig':'Simpan'},'Simpan')
      ])
    ])
  ]);
  modal.classList.add('w-full','max-w-2xl');
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  document.getElementById('btnSaveGrad').onclick = async ()=>{
    const btn = document.getElementById('btnSaveGrad');
    btnBusy(btn,true,'Menyimpan...');
    try{
      const decision = (document.getElementById('g_dec').value||'').trim();
      const reason = (document.getElementById('g_reason').value||'').trim();
      const payload = { participant_id: it.participant_id, decision, reason };
      const r = await callOrQueue(() => callApi('graduateParticipant', payload), 'graduateParticipant', payload, 'Kelulusan');
      if(!r.ok) throw new Error(r.error||'Gagal');

      // optimistic cache
      const pidCtx = currentProgramId_();
      const merged = Object.assign({}, it, {  decision, reason,  updated_at: new Date().toISOString(),  __local_pending: !!r.queued,  __src: (r.queued ? 'LOCAL' : 'SERVER')});
      await cacheUpsert('graduations', { id: String(it.participant_id), data: merged }, { program_id: pidCtx });
      toast('Keputusan disimpan','ok');
      overlay.remove();
      renderGraduation();
    }catch(e){ toast(e.message,'error'); }
    finally{ btnBusy(btn,false,'Simpan'); }
  };
}


async function renderCertificates(){
  if (String(currentProgramId_()||'') === '__ALL__') {
    toast('Silakan pilih program tertentu (bukan "Semua Program") untuk menu ini.', 'info');
    return renderDashboard();
  }

  const v = setViewTitle('Sertifikat', 'Terbitkan sertifikat peserta & mentor');
  const pid = currentProgramId_();
  const roleN = (String(state.user?.role||'').trim().toUpperCase()==='ADMINISTRATOR') ? 'ADMIN' : String(state.user?.role||'').trim().toUpperCase();
  const canIssue = (roleN==='ADMIN' || roleN==='MANAGER' || roleN==='KTU');

  const info = h('div',{class:'mb-3 text-xs text-slate-500 dark:text-slate-400'},'Memuat dari cache...');
  v.appendChild(info);

  const top = h('div',{class:'flex flex-wrap gap-2 mb-4'},[
    ...(canIssue ? [h('button',{class:'rounded-2xl px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700 text-sm', onclick:async ()=>{
      const pidP = prompt('participant_id untuk terbitkan sertifikat peserta:','');
      if(!pidP) return;
      const payload = { person_type:'PESERTA', person_id: pidP };
      const rr = await callOrQueue(() => callApi('issueCertificate', payload), 'issueCertificate', payload, 'Terbitkan Sertifikat');
      if(!rr.ok) return toast(rr.error||'Gagal','error');

      const pidCtx = currentProgramId_();
      const localCertId = 'loc_cert_' + Date.now() + '_' + Math.random().toString(36).slice(2);
      await cacheUpsert('certificates', { id: localCertId, data: {
        cert_id: localCertId,
        program_id: pidCtx,
        person_type: 'PESERTA',
        person_id: pidP,
        certificate_no: rr.certificate_no || '',
        verify_code: rr.verify_code || '',
        issue_date: formatDateISO(new Date()),
        pdf_url: rr.pdf_url || '',
        __local_pending: !!rr.queued,
        __src: (rr.queued?'LOCAL':'SERVER')
      }}, { program_id: pidCtx });

      toast(rr.queued ? 'Di-antrikan (offline).' : 'Sertifikat peserta diterbitkan','ok');
      renderCertificates();
    }},'Terbitkan Sertifikat Peserta')] : []),

    ...(canIssue ? [h('button',{class:'rounded-2xl px-4 py-2 border border-slate-200 dark:border-slate-800 text-sm', onclick:async ()=>{
      const mid = prompt('mentor_id untuk terbitkan sertifikat mentor:','');
      if(!mid) return;
      const payload = { person_type:'MENTOR', person_id: mid };
      const rr = await callOrQueue(() => callApi('issueCertificate', payload), 'issueCertificate', payload, 'Terbitkan Sertifikat');
      if(!rr.ok) return toast(rr.error||'Gagal','error');

      const pidCtx = currentProgramId_();
      const localCertId = 'loc_cert_' + Date.now() + '_' + Math.random().toString(36).slice(2);
      await cacheUpsert('certificates', { id: localCertId, data: {
        cert_id: localCertId,
        program_id: pidCtx,
        person_type: 'MENTOR',
        person_id: mid,
        certificate_no: rr.certificate_no || '',
        verify_code: rr.verify_code || '',
        issue_date: formatDateISO(new Date()),
        pdf_url: rr.pdf_url || '',
        __local_pending: !!rr.queued,
        __src: (rr.queued?'LOCAL':'SERVER')
      }}, { program_id: pidCtx });

      toast(rr.queued ? 'Di-antrikan (offline).' : 'Sertifikat mentor diterbitkan','ok');
      renderCertificates();
    }},'Terbitkan Sertifikat Mentor')] : []),

    h('button',{class:'rounded-2xl px-4 py-2 border border-slate-200 dark:border-slate-800 text-sm', onclick:()=>renderCertificates()},'Refresh'),
  ]);
  v.appendChild(top);

  const host = h('div',{},[
    card([ h('div',{class:'text-sm text-slate-500 dark:text-slate-400'},'Memuat...') ])
  ]);
  v.appendChild(host);

  localFirstHydrateList_({
    store:'certificates',
    fetchFn: ()=> callApi('listCertificates', {}),
    filter:{ program_id: pid },
    idKey:'cert_id',
    serverPickKey:'items',
    viewToken: ()=> state.viewKey === 'certificates',
    onUpdate: ({ items, from, meta, error, refreshing })=>{
      info.textContent = `Cache Sertifikat: ${meta?.ts ? new Date(meta.ts).toLocaleString('id-ID') : '-'} • ${refreshing ? 'refresh...' : (from==='server' ? 'SERVER refresh' : 'CACHE only')}${error ? (' • Offline: ' + error) : ''}`;

      const rows = (items||[]).map(x=>[
        srcBadge_(rowSrc_(x), !!x.__local_pending),
        x.person_type||'-',
        x.person_id||'-',
        x.certificate_no||'-',
        x.issue_date ? formatDateDMYID(x.issue_date) : '-',
        x.pdf_url ? h('a',{href:x.pdf_url, target:'_blank', class:'text-emerald-700 dark:text-emerald-300 underline'},'PDF') : '-'
      ]);

      host.innerHTML='';
      host.appendChild(card([ table(['SRC','Tipe','ID','No Sertifikat','Tanggal','File'], rows) ]));
    }
  });
}



async function renderIncentives(){
  if (String(currentProgramId_()||'') === '__ALL__') {
    toast('Silakan pilih program tertentu (bukan "Semua Program") untuk menu ini.', 'info');
    return renderDashboard();
  }

  const v = setViewTitle('Insentif Mentor', 'Tracking & verifikasi insentif');
  const pid = currentProgramId_();

  const info = h('div',{class:'mb-3 text-xs text-slate-500 dark:text-slate-400'},'Memuat dari cache...');
  v.appendChild(info);

  const host = h('div',{},[
    card([ h('div',{class:'text-sm text-slate-500 dark:text-slate-400'},'Memuat...') ])
  ]);
  v.appendChild(host);

  localFirstHydrateList_({
    store:'incentives',
    fetchFn: ()=> callApi('listMentorIncentives', {}),
    filter:{ program_id: pid },
    idKey:'incentive_id',
    serverPickKey:'items',
    viewToken: ()=> state.viewKey === 'incentives',
    onUpdate: ({ items, from, meta, error, refreshing })=>{
      info.textContent = `Cache Insentif: ${meta?.ts ? new Date(meta.ts).toLocaleString('id-ID') : '-'} • ${refreshing ? 'refresh...' : (from==='server' ? 'SERVER refresh' : 'CACHE only')}${error ? (' • Offline: ' + error) : ''}`;

      const rows = (items||[]).map(x=>[
        srcBadge_(rowSrc_(x), !!x.__local_pending),
        x.mentor_name||'-',
        x.participant_name||'-',
        badge(x.stage||'-'),
        x.amount||'-',
        x.due_date||'-',
        badge(x.status||'-'),
        h('button',{class:'rounded-xl px-3 py-2 text-xs border border-slate-200 dark:border-slate-800', onclick:async ()=>{
          const payload = { incentive_id: x.incentive_id, status:'VERIFIED' };
          const rr = await callOrQueue(() => callApi('verifyIncentive', payload), 'verifyIncentive', payload, 'Verify insentif');
          if(!rr.ok) return toast(rr.error||'Gagal','error');

          const pidCtx = currentProgramId_();
          const merged = Object.assign({}, x, {
            status:'VERIFIED',
            verified_by: state.user?.nik||'',
            verified_at: new Date().toISOString(),
            __local_pending: !!rr.queued,
            __src: (rr.queued?'LOCAL':'SERVER')
          });
          await cacheUpsert('incentives', { id:String(x.incentive_id), data: merged }, { program_id: pidCtx });

          toast(rr.queued ? 'Di-antrikan (offline)' : 'Terverifikasi','ok');
          renderIncentives();
        }},'Verify')
      ]);

      host.innerHTML='';
      host.appendChild(card([ table(['SRC','Mentor','Mentee','Stage','Amount','Due','Status','Aksi'], rows) ]));
    }
  });
}


async function renderMyMentee(){
  const v = setViewTitle('Mentee Saya', 'Daftar mentee untuk mentor');
  const r = await callApi('myMentees', {});
  if(!r.ok) return v.appendChild(card([h('div',{class:'text-rose-600'}, r.error||'Gagal')]));
  const items = r.items||[];
  v.appendChild(card([
    table(['Mentee','Status','Mulai','Aksi'], items.map(x=>[
      `${x.participant_name} (${x.participant_nik})`,
      badge(x.participant_status||'-'),
      x.start_date||'-',
      h('button',{class:'rounded-xl px-3 py-2 text-xs border border-slate-200 dark:border-slate-800', onclick:()=>toast('Gunakan menu Monitoring untuk input log harian', 'info')},'Input Log')
    ]))
  ]));
}

// -------------------- Settings (Admin + Change PIN) --------------------
async function renderSettings(){
  const isAdmin = ((String(state.user?.role||'').trim().toUpperCase()==='ADMIN') || (String(state.user?.role||'').trim().toUpperCase()==='ADMINISTRATOR'));
  const v = setViewTitle('Pengaturan', isAdmin ? 'Konfigurasi aplikasi, logo, dan user' : 'Ganti PIN Anda');

  async function loadSettingsCached_(estateCode=''){
    const id = 'settings:' + (estateCode || '__GLOBAL__');
    const rows = await cacheGetAll('settings');
    const hit = rows.find(x => String(x.__estate||'')===String(estateCode||'')) || rows.find(x => String(x.__estate||'')==='' ) || null;
    if (hit) return hit;
    const byId = rows.find(x => String(x.id||'')===id) || null;
    return byId || {};
  }

  let settings = {};
  try {
    const r = await callApi('getSettings', {});
    if (r && r.ok) {
      settings = r.settings || {};
      if (isAdmin) {
        await cacheUpsert('settings', { id:'settings:__GLOBAL__', data: Object.assign({ __estate:'' }, settings) });
      }
    }
  } catch (e) {
    const cached = await loadSettingsCached_('');
    settings = cached || {};
  }

  // Change PIN (all roles)
  const pinCard = card([
    h('div',{class:'font-semibold'},'Ganti PIN'),
    h('div',{class:'text-xs text-slate-500 dark:text-slate-400 mt-1'},'PIN dipakai untuk login. Simpan dengan aman.'),
    h('div',{class:'mt-4 grid md:grid-cols-3 gap-3'},[
      h('div',{},[
        h('label',{class:'text-sm text-slate-600 dark:text-slate-300'},'PIN Lama'),
        h('input',{id:'sp_old', type:'password', class:'mt-1 w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-3 text-sm'})
      ]),
      h('div',{},[
        h('label',{class:'text-sm text-slate-600 dark:text-slate-300'},'PIN Baru'),
        h('input',{id:'sp_new', type:'password', class:'mt-1 w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-3 text-sm'})
      ]),
      h('div',{class:'flex items-end'},[
        h('button',{id:'btnPin', class:'w-full rounded-2xl px-4 py-3 bg-emerald-600 text-white hover:bg-emerald-700 text-sm flex items-center justify-center gap-2'},[
          h('span',{'data-spinner':'', class:'hidden w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin'}),
          h('span',{'data-label':'','data-orig':'Simpan'},'Simpan')
        ])
      ])
    ])
  ]);
  v.appendChild(pinCard);

  document.getElementById('btnPin').onclick = async ()=>{
    const btn = document.getElementById('btnPin');
    btnBusy(btn,true,'Menyimpan...');
    try{
      const payload = { old_pin: (document.getElementById('sp_old').value||'').trim(), new_pin: (document.getElementById('sp_new').value||'').trim() };
      const rr = await callOrQueue(() => callApi('changeMyPin', payload), 'changeMyPin', payload, 'Ganti PIN');
      if(!rr.ok) throw new Error(rr.error||'Gagal');
      toast(rr.queued ? 'Permintaan ganti PIN di-antrikan (offline)' : 'PIN berhasil diganti','ok');
      document.getElementById('sp_old').value='';
      document.getElementById('sp_new').value='';
    }catch(e){ toast(e.message,'error'); }
    finally{ btnBusy(btn,false,'Simpan'); }
  };

  if (!isAdmin) return;

  // Multi-estate context (Admin): pilih estate untuk mengatur nama, manager & logo.
  const estateOptions = Array.isArray(settings.estateOptions) ? settings.estateOptions : [];
  state._estateOptions = estateOptions;
  let currentEstateCode = String(settings.estateCode || state.user?.estate || estateOptions[0] || '').trim();

  // App settings
  v.appendChild(h('div',{class:'mt-6'},[]));
  v.appendChild(card([
    h('div',{class:'font-semibold'},'Pengaturan Aplikasi'),
    h('div',{class:'text-xs text-slate-500 dark:text-slate-400 mt-1'},'Mengubah nama aplikasi dan tanda tangan sertifikat.'),
    h('div',{class:'mt-4 grid md:grid-cols-3 gap-3'},[
      fieldS('Nama Aplikasi','set_appName', settings.appName || settings.appTitle || 'Sekolah Pemanen'),
      h('div',{},[
        h('label',{class:'text-sm text-slate-600 dark:text-slate-300'},'Estate (Kode)'),
        h('select',{id:'set_estateCode', class:'mt-1 w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-3 text-sm'},[
          h('option',{value:''},'-- Pilih Estate --'),
          ...estateOptions.map(code=>h('option',{value:code}, code))
        ])
      ]),
      fieldS('Nama Estate','set_estateName', settings.estateName || ''),
      fieldS('Nama Manager (Tanda Tangan)','set_managerName', settings.managerName || ''),
    ]),
    h('div',{class:'text-xs text-slate-500 dark:text-slate-400 mt-2'},'Catatan: Nama Estate dan Nama Manager bersifat per-estate (multi estate). Logo perusahaan 1 untuk semua estate.'),
    h('div',{class:'mt-4 flex justify-end'},[
      h('button',{id:'btnSaveSettings', class:'rounded-2xl px-4 py-3 bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 text-sm flex items-center gap-2'},[
        h('span',{'data-spinner':'', class:'hidden w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin'}),
        h('span',{'data-label':'','data-orig':'Simpan Pengaturan'},'Simpan Pengaturan')
      ])
    ])
  ]));

  // Set default selected estate
  const selEstate = document.getElementById('set_estateCode');
  if (selEstate) selEstate.value = currentEstateCode;
  if (selEstate) selEstate.onchange = async ()=>{
    const code = (selEstate.value||'').trim();
    if(!code) return;
    currentEstateCode = code;
    let s2 = {};
    try {
      const rr = await callApi('getSettings', { estate: currentEstateCode });
      if(!rr.ok) throw new Error(rr.error||'Gagal load settings estate');
      s2 = rr.settings || {};
      await cacheUpsert('settings', { id:'settings:'+currentEstateCode, data: Object.assign({ __estate: currentEstateCode }, s2) });
    } catch (e) {
      const all = await cacheGetAll('settings');
      s2 = all.find(x => String(x.__estate||'')===String(currentEstateCode)) || {};
      if (!Object.keys(s2||{}).length) return toast((e && e.message) ? e.message : 'Offline dan cache kosong', 'error');
    }
    document.getElementById('set_estateName').value = s2.estateName || '';
    document.getElementById('set_managerName').value = s2.managerName || '';
    document.getElementById('logoInfo').textContent = s2.companyLogoFileId ? `companyLogoFileId: ${s2.companyLogoFileId}` : 'Belum ada logo';
  };

  document.getElementById('btnSaveSettings').onclick = async ()=>{
    const btn = document.getElementById('btnSaveSettings');
    btnBusy(btn,true,'Menyimpan...');
    try{
      const estateCode = (document.getElementById('set_estateCode').value||'').trim();
      if(!estateCode) throw new Error('Pilih Estate (Kode) terlebih dulu');
      const items = [
        { key:'appName', value:(document.getElementById('set_appName').value||'').trim() },
        { key:'estateName', value:(document.getElementById('set_estateName').value||'').trim() },
        { key:'managerName', value:(document.getElementById('set_managerName').value||'').trim() },
      ];
      const payload = { estate: estateCode, items_json: JSON.stringify(items) };
      const rr = await callOrQueue(() => callApi('setSettings', payload), 'setSettings', payload, 'Simpan pengaturan');
      if(!rr.ok) throw new Error(rr.error||'Gagal');
      // optimistic cache
      const all = await cacheGetAll('settings');
      const cur = all.find(x => String(x.__estate||'')===String(estateCode)) || {};
      const merged = Object.assign({}, cur, { __estate: estateCode }, Object.fromEntries(items.map(i=>[i.key,i.value])));
      await cacheUpsert('settings', { id:'settings:'+estateCode, data: merged });
      toast('Pengaturan tersimpan','ok');
    }catch(e){ toast(e.message,'error'); }
    finally{ btnBusy(btn,false,'Simpan Pengaturan'); }
  };

  // Logo upload
  v.appendChild(h('div',{class:'mt-4'},[]));
  v.appendChild(card([
    h('div',{class:'font-semibold'},'Logo Perusahaan'),
    h('div',{class:'text-xs text-slate-500 dark:text-slate-400 mt-1'},'Upload logo untuk digunakan di Sertifikat & halaman Verifikasi.'),
    h('div',{class:'mt-4 flex flex-col sm:flex-row sm:items-center gap-3'},[
      h('input',{id:'logoFile', type:'file', accept:'image/*', class:'block w-full text-sm text-slate-600 dark:text-slate-300'}),
      h('button',{id:'btnUploadLogo', class:'rounded-2xl px-4 py-3 bg-emerald-600 text-white hover:bg-emerald-700 text-sm flex items-center gap-2'},[
        h('span',{'data-spinner':'', class:'hidden w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin'}),
        h('span',{'data-label':'','data-orig':'Upload'},'Upload')
      ])
    ]),
    h('div',{id:'logoInfo', class:'mt-2 text-xs text-slate-500'}, settings.companyLogoFileId ? `companyLogoFileId: ${settings.companyLogoFileId}` : 'Belum ada logo')
  ]));

  document.getElementById('btnUploadLogo').onclick = async ()=>{
    const inp = document.getElementById('logoFile');
    const file = inp.files && inp.files[0];
    if(!file) return toast('Pilih file logo dulu', 'error');
    const btn = document.getElementById('btnUploadLogo');
    btnBusy(btn,true,'Upload...');
    try{
      // Upload via hidden form/iframe to avoid CORS preflight (GAS does not support OPTIONS).
      const dataUrl = await readAsDataUrl(file);
      const rr = await uploadLogoViaForm({
        token: state.token,
        fileName: file.name,
        dataUrl
      });
      if(!rr.ok) throw new Error(rr.error||'Gagal upload');
      toast('Logo terupload','ok');
      document.getElementById('logoInfo').textContent = `companyLogoFileId: ${rr.fileId}`;
    }catch(e){ toast(e.message,'error'); }
    finally{ btnBusy(btn,false,'Upload'); }
  };

  function uploadLogoViaForm({ token, fileName, dataUrl }){
    // Dulu pakai iframe (kena X-Frame-Options sameorigin). Sekarang pakai POST fetch no-preflight via callApiPost.
    return callApiPost('uploadLogo', {
      file_name: fileName || 'logo.png',
      data_url: dataUrl || '',
    });
  }


  // Master Estate management (Admin)
  v.appendChild(h('div',{class:'mt-4'},[]));
  const estatesHolder = h('div',{id:'masterEstatesHolder'},[h('div',{class:'text-sm text-slate-500'},'Memuat Master Estate...')]);
  v.appendChild(card([
    h('div',{class:'flex items-center justify-between'},[
      h('div',{},[
        h('div',{class:'font-semibold'},'Master Estate'),
        h('div',{class:'text-xs text-slate-500 dark:text-slate-400 mt-1'},'CRUD daftar estate untuk dropdown & governance (Admin saja).')
      ]),
      h('button',{class:'rounded-2xl px-4 py-2 text-sm bg-emerald-600 text-white', onclick:()=>openMasterEstateModal(null, refreshMasterEstates)},'Tambah Estate')
    ]),
    h('div',{class:'mt-4'},[estatesHolder])
  ]));

  async function refreshMasterEstates(){
    let items = [];
    try {
      const rr = await callApi('listMasterEstates', {});
      if(!rr.ok) throw new Error(rr.error||'Gagal');
      items = rr.items || [];
      await cacheReplace('master_estates', items.map(x=>({ id:String(x.estate_code||''), data:x })), {});
    } catch (e) {
      items = await cacheGetAll('master_estates');
      if (!items.length) {
        estatesHolder.innerHTML='';
        estatesHolder.appendChild(h('div',{class:'text-rose-600'}, (e && e.message) ? e.message : 'Offline dan cache kosong'));
        return;
      }
    }
    state._estateOptions = items.filter(x=>x.active!==false).map(x=>x.estate_code);
    estatesHolder.innerHTML='';
    estatesHolder.appendChild(table(['Kode','Nama Estate','Manager','Active','Aksi'], items.map(e=>[
      e.estate_code||'-',
      e.estate_name||'-',
      e.manager_name||'-',
      badge(String(e.active!==false)),
      h('div',{class:'flex gap-2'},[
        h('button',{class:'rounded-xl px-3 py-2 text-xs border border-slate-200 dark:border-slate-800', onclick:()=>openMasterEstateModal(e, refreshMasterEstates)},'Edit'),
        h('button',{class:'rounded-xl px-3 py-2 text-xs bg-rose-600 text-white', onclick:()=>deleteMasterEstate(e.estate_code)},'Hapus'),
      ])
    ])));
  }

  async function deleteMasterEstate(estate_code){
    if(!estate_code) return;
    if(!confirm('Hapus Master Estate ini?')) return;
    const payload = { estate_code };
    const rr = await callOrQueue(() => callApi('deleteMasterEstate', payload), 'deleteMasterEstate', payload, 'Hapus Master Estate');
    if(!rr.ok) return toast(rr.error||'Gagal','error');
    await cacheDelete('master_estates', estate_code);
    toast(rr.queued ? 'Di-antrikan (offline)' : 'Master Estate dihapus','ok');
    refreshMasterEstates();
  }

  function openMasterEstateModal(row, onDone){
  const isEdit = !!row;

  const { body, close } = openModal_({
    title: isEdit ? 'Edit Master Estate' : 'Tambah Master Estate',
    subtitle: 'Header tetap, isi form bisa di-scroll.',
    maxWidth: 'max-w-3xl'
  });

  body.appendChild(h('div',{class:'grid md:grid-cols-2 gap-3'},[
    mfield('Kode Estate (SRIE, dst)','me_code', row?.estate_code||'', { disabled:isEdit }),
    mfield('Nama Estate','me_name', row?.estate_name||''),
    mfield('Nama Manager','me_manager', row?.manager_name||''),
    mfield('Active (TRUE/FALSE)','me_active', String(row?.active!==false)),
  ]));

  body.appendChild(h('div',{class:'mt-5 flex justify-end gap-2'},[
    h('button',{class:'rounded-2xl px-4 py-2 text-sm border border-slate-200 dark:border-slate-800', onclick: close},'Batal'),
    h('button',{id:'btnSaveME', class:'rounded-2xl px-4 py-2 text-sm bg-emerald-600 text-white hover:bg-emerald-700 flex items-center gap-2'},[
      h('span',{'data-spinner':'', class:'hidden w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin'}),
      h('span',{'data-label':'','data-orig':'Simpan'},'Simpan')
    ])
  ]));

  const codeInp = document.getElementById('me_code');
  if (codeInp) codeInp.value = String(codeInp.value||'').toUpperCase();
  if (codeInp && !isEdit) codeInp.addEventListener('input', ()=>{ codeInp.value = (codeInp.value||'').toUpperCase(); });

  document.getElementById('btnSaveME').onclick = async ()=>{
    const btn = document.getElementById('btnSaveME');
    btnBusy(btn,true,'Menyimpan...');
    try{
      const payload = {
        estate_code: (document.getElementById('me_code').value||'').trim().toUpperCase(),
        estate_name: (document.getElementById('me_name').value||'').trim(),
        manager_name: (document.getElementById('me_manager').value||'').trim(),
        active: (document.getElementById('me_active').value||'').trim().toUpperCase()==='FALSE' ? 'FALSE' : 'TRUE'
      };
      if(!payload.estate_code) throw new Error('Kode estate wajib');
      const rr = await callOrQueue(() => callApi('upsertMasterEstate', payload), 'upsertMasterEstate', payload, 'Simpan Master Estate');
      if(!rr.ok) throw new Error(rr.error||'Gagal');
      await cacheUpsert('master_estates', { id:String(payload.estate_code), data: Object.assign({}, row||{}, payload, { updated_at: new Date().toISOString(), __local_pending: !!rr.queued }) });
      toast('Master Estate tersimpan','ok');
      close();
      onDone && onDone();
    }catch(e){ toast(e.message,'error'); }
    finally{ btnBusy(btn,false,'Simpan'); }
  };

  function mfield(label,id,val,opt){
    opt = opt||{};
    const attrs = { id, value:val||'', class:'mt-1 w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-3 text-sm' };
    if (opt.disabled) attrs.disabled = true;
    return h('div',{},[
      h('label',{class:'text-sm text-slate-600 dark:text-slate-300'},label),
      h('input', attrs)
    ]);
  }
}

  await refreshMasterEstates();

  // User management
  v.appendChild(h('div',{class:'mt-4'},[]));
  const usersHolder = h('div',{id:'usersHolder'},[h('div',{class:'text-sm text-slate-500'},'Memuat user...')]);
  v.appendChild(card([
    h('div',{class:'flex items-center justify-between'},[
      h('div',{},[
        h('div',{class:'font-semibold'},'Pengelolaan User'),
        h('div',{class:'text-xs text-slate-500 dark:text-slate-400 mt-1'},'Tambah, hapus, reset PIN, dan ganti PIN user')
      ]),
      h('button',{class:'rounded-2xl px-4 py-2 text-sm bg-emerald-600 text-white', onclick:()=>openUserModal(null, refreshUsers)},'Tambah User')
    ]),
    h('div',{class:'mt-4'},[usersHolder])
  ]));

  async function refreshUsers(){
    let items = [];
    try {
      const rr = await callApi('listUsers', {});
      if(!rr.ok) throw new Error(rr.error||'Gagal');
      items = rr.items || [];
      await cacheReplace('users', items.map(x=>({ id:String(x.user_id||x.nik||''), data:x })), {});
    } catch (e) {
      items = await cacheGetAll('users');
      if (!items.length) {
        usersHolder.innerHTML='';
        usersHolder.appendChild(h('div',{class:'text-rose-600'}, (e && e.message) ? e.message : 'Offline dan cache kosong'));
        return;
      }
    }
    usersHolder.innerHTML='';
    usersHolder.appendChild(table(['NIK','Nama','Role','Active','Aksi'], items.map(u=>[
      u.nik||'-',
      u.name||'-',
      badge(u.role||'-'),
      badge(String(u.active||'TRUE')),
      h('div',{class:'flex gap-2'},[
        h('button',{class:'rounded-xl px-3 py-2 text-xs border border-slate-200 dark:border-slate-800', onclick:()=>openUserModal(u, refreshUsers)},'Edit'),
        h('button',{class:'rounded-xl px-3 py-2 text-xs bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900', onclick:()=>resetPin(u.user_id)},'Reset PIN'),
        h('button',{class:'rounded-xl px-3 py-2 text-xs bg-rose-600 text-white', onclick:()=>deleteUser(u.user_id)},'Hapus'),
      ])
    ])));
  }
  async function resetPin(user_id){
    if(!user_id) return;
    const newPin = prompt('PIN baru (kosong=1234):','1234');
    if(newPin===null) return;
    const payload = { user_id, new_pin: (newPin||'1234').trim() };
    const rr = await callOrQueue(() => callApi('resetUserPin', payload), 'resetUserPin', payload, 'Reset PIN');
    if(!rr.ok) return toast(rr.error||'Gagal','error');
    // cache: update pin locally (untuk admin referensi; tetap sensitif, tapi ini memang sudah ada di sheet)
    const all = await cacheGetAll('users');
    const u = all.find(x=>String(x.user_id||'')===String(user_id)) || null;
    if (u) {
      u.pin = payload.new_pin;
      u.updated_at = new Date().toISOString();
      u.__local_pending = !!rr.queued;
      await cacheUpsert('users', { id:String(user_id), data:u });
    }
    toast(rr.queued ? 'Di-antrikan (offline)' : 'PIN direset','ok');
  }
  async function deleteUser(user_id){
    if(!user_id) return;
    if(!confirm('Hapus user ini?')) return;
    const payload = { user_id };
    const rr = await callOrQueue(() => callApi('deleteUser', payload), 'deleteUser', payload, 'Hapus user');
    if(!rr.ok) return toast(rr.error||'Gagal','error');
    await cacheDelete('users', user_id);
    toast(rr.queued ? 'Di-antrikan (offline)' : 'User dihapus','ok');
    refreshUsers();
  }
  await refreshUsers();

  function fieldS(label,id,val){
    return h('div',{},[
      h('label',{class:'text-sm text-slate-600 dark:text-slate-300'},label),
      h('input',{id, value:val||'', class:'mt-1 w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-3 text-sm'})
    ]);
  }
}

function readAsDataUrl(file){
  return new Promise((resolve,reject)=>{
    const r = new FileReader();
    r.onload = ()=>resolve(String(r.result||''));
    r.onerror = ()=>reject(new Error('Gagal baca file'));
    r.readAsDataURL(file);
  });
}

function openUserModal(user, onDone){
  const isEdit = !!user;

  const { body, close } = openModal_({
    title: isEdit ? 'Edit User' : 'Tambah User',
    subtitle: 'Header tetap, isi form bisa di-scroll.',
    maxWidth: 'max-w-3xl'
  });

  body.appendChild(h('div',{class:'grid md:grid-cols-2 gap-3'},[
    ufield('NIK','u_nik', user?.nik||''),
    ufield('Nama','u_name', user?.name||''),
    ufield('Role (ADMIN/ASISTEN/MANDOR/MENTOR)','u_role', user?.role||'MANDOR'),
    ufield('Active (TRUE/FALSE)','u_active', String(user?.active||'TRUE')),
    uEstateSelect('Estate (Kode)','u_estate', user?.estate||''),
    uDivisiField('Divisi (angka)','u_divisi', user?.unit||user?.divisi||''),
    ufield('PIN (kosong = tidak diubah)','u_pin',''),
  ]));

  body.appendChild(h('div',{class:'mt-5 flex justify-end gap-2'},[
    h('button',{class:'rounded-2xl px-4 py-2 text-sm border border-slate-200 dark:border-slate-800', onclick: close},'Batal'),
    h('button',{id:'btnSaveUser', class:'rounded-2xl px-4 py-2 text-sm bg-emerald-600 text-white hover:bg-emerald-700 flex items-center gap-2'},[
      h('span',{'data-spinner':'', class:'hidden w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin'}),
      h('span',{'data-label':'','data-orig':'Simpan'},'Simpan')
    ])
  ]));

  const se = document.getElementById('u_estate');
  if (se) se.value = String(user?.estate||'').trim().toUpperCase();

  document.getElementById('btnSaveUser').onclick = async ()=>{
    const btn = document.getElementById('btnSaveUser');
    btnBusy(btn,true,'Menyimpan...');
    try{
      const payload = {
        user_id: user?.user_id||'',
        nik: (document.getElementById('u_nik').value||'').trim(),
        name: (document.getElementById('u_name').value||'').trim(),
        role: (document.getElementById('u_role').value||'').trim(),
        active: (document.getElementById('u_active').value||'').trim(),
        estate: (document.getElementById('u_estate').value||'').trim().toUpperCase(),
        divisi: (document.getElementById('u_divisi').value||'').trim(),
        pin: (document.getElementById('u_pin').value||'').trim(),
      };
      const rr = await callOrQueue(() => callApi('upsertUser', payload), 'upsertUser', payload, 'Simpan user');
      if(!rr.ok) throw new Error(rr.error||'Gagal');
      const uid = rr.user_id || payload.user_id || payload.nik;
      await cacheUpsert('users', { id:String(uid), data: Object.assign({}, user||{}, payload, { user_id: uid, updated_at: new Date().toISOString(), __local_pending: !!rr.queued }) });
      toast('User tersimpan','ok');
      close();
      onDone && onDone();
    }catch(e){ toast(e.message,'error'); }
    finally{ btnBusy(btn,false,'Simpan'); }
  };

  function ufield(label,id,val, type){
    const attrs = {id, value:val||'', class:'mt-1 w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-3 text-sm'};
    if (type) attrs.type = type;
    return h('div',{},[
      h('label',{class:'text-sm text-slate-600 dark:text-slate-300'},label),
      h('input',attrs)
    ]);
  }

  function uDivisiField(label,id,val){
    return h('div',{},[
      h('label',{class:'text-sm text-slate-600 dark:text-slate-300'},label),
      h('input',{id, value:val||'', inputmode:'numeric', placeholder:'mis. 1, 2, 3', class:'mt-1 w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-3 text-sm'})
    ]);
  }

  function uEstateSelect(label,id,val){
    const opts = Array.isArray(state._estateOptions) ? state._estateOptions : [];
    return h('div',{},[
      h('label',{class:'text-sm text-slate-600 dark:text-slate-300'},label),
      h('select',{id, class:'mt-1 w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-3 text-sm'},[
        h('option',{value:''},'-- Pilih Estate --'),
        ...opts.map(code=>h('option',{value:code},code))
      ])
    ]);
  }
}

// ======================
// SINKRONISASI (Offline-first)
// ======================
async function renderSync() {
  const roleRaw = String(state.user?.role||'').trim().toUpperCase();
  const role = (roleRaw === 'ADMINISTRATOR') ? 'ADMIN' : roleRaw;
  const v = setViewTitle('Sinkronisasi', 'Tarik data ke IndexedDB & kirim antrian (outbox) ke server');

  const pid = currentProgramId_();

  const estates = (state.estates || []).map(x => x.estate_code || x.code || x).filter(Boolean);
  const myEstate = (state.user?.estate || state.user?.estate_code || state.myEstate || '').toUpperCase();

  // Header info
  const ob = await outboxList();
  const info = h('div',{class:'mb-4 grid md:grid-cols-3 gap-3'},[
    card([
      h('div',{class:'text-xs text-slate-500 dark:text-slate-400'},'Program Context'),
      h('div',{class:'mt-1 font-semibold'}, pid || '-'),
      h('div',{class:'mt-2 text-xs text-slate-500 dark:text-slate-400'}, pid==='__ALL__' ? 'Catatan: __ALL__ hanya untuk menu Dashboard / data master.' : 'Program-scoped sync.'),
    ]),
    card([
      h('div',{class:'text-xs text-slate-500 dark:text-slate-400'},'Outbox (antrian)'),
      h('div',{class:'mt-1 text-2xl font-semibold'}, String(ob.length)),
      h('div',{class:'mt-2 text-xs text-slate-500 dark:text-slate-400'}, ob.length ? 'Ada perubahan lokal yang belum terkirim' : 'Tidak ada antrian'),
    ]),
    card([
      h('div',{class:'text-xs text-slate-500 dark:text-slate-400'},'Estate'),
      h('div',{class:'mt-1 font-semibold'}, myEstate || '-'),
      h('div',{class:'mt-2 text-xs text-slate-500 dark:text-slate-400'}, role==='ADMIN' ? 'Admin bisa tarik data master semua estate' : 'Scoped sesuai akun'),
    ]),
  ]);
  v.appendChild(info);

  // NOTE: tiap scope diikat ke action backend. Kalau role tidak boleh akses action tersebut,
  // checkbox akan otomatis DISABLE (tidak ikut pull, tidak masuk cache).
  const scopes = [
    { key:'programs', label:'Programs (master)', action:'listPrograms', adminOnly:false },
    { key:'master_estates', label:'MasterEstates (master)', action:'listMasterEstates', adminOnly:true },
    { key:'users', label:'Users (master)', action:'listUsers', adminOnly:true },
    { key:'settings', label:'Settings (master)', action:'getSettings', adminOnly:true },

    { key:'candidates', label:'Candidates', action:'listCandidates', adminOnly:false, needsProgram:true },
    { key:'selection', label:'SelectionResults (view)', action:'listSelection', adminOnly:false, needsProgram:true },
    { key:'participants', label:'Participants', action:'listParticipants', adminOnly:false, needsProgram:true },

    // mentors & pairings sama-sama dari endpoint listMentors
    { key:'mentors', label:'Mentors', action:'listMentors', adminOnly:false, needsProgram:true },
    { key:'pairings', label:'Pairings', action:'listMentors', adminOnly:false, needsProgram:true },

    { key:'daily_logs', label:'DailyLogs', action:'getDailyLogs', adminOnly:false, needsProgram:true },
    { key:'graduations', label:'Graduations', action:'listGraduation', adminOnly:false, needsProgram:true },
    { key:'certificates', label:'Certificates', action:'listCertificates', adminOnly:false, needsProgram:true },
    { key:'incentives', label:'MentorIncentives', action:'listMentorIncentives', adminOnly:false, needsProgram:true },
  ];

  // Normalize perms/actions supaya tidak gagal gara-gara beda format (array/string/json/object)
  function _normalizeActionName(x){
    let s = String(x || '').trim().toLowerCase();
    if (!s) return '';
    // buang prefix yang kadang ikut kebawa
    s = s.replace(/^action\s*[:=]\s*/,'');
    s = s.replace(/^action=/,'');
    return s.trim();
  }

  function _extractActions(raw){
    // raw bisa: array | string "a,b" | string JSON '["a","b"]' | object {a:true}
    if (raw === null || raw === undefined) return [];

    // jika JSON string
    if (typeof raw === 'string') {
      const t = raw.trim();
      if (!t) return [];
      if ((t.startsWith('[') && t.endsWith(']')) || (t.startsWith('{') && t.endsWith('}'))) {
        try { return _extractActions(JSON.parse(t)); } catch(e) { /* lanjut split biasa */ }
      }
      // CSV / spaced list
      return t.split(/[,;\n\r\t ]+/).map(s=>s.trim()).filter(Boolean);
    }

    if (Array.isArray(raw)) return raw;

    if (typeof raw === 'object') {
      // beberapa bentuk object yang mungkin
      if (Array.isArray(raw.actions)) return raw.actions;
      if (Array.isArray(raw.allowed)) return raw.allowed;
      // kalau object map: {listPrograms:true,...}
      return Object.keys(raw || {});
    }
    
    return [];
    
  }

  const rawActs =
    (state.user && state.user.perms ? state.user.perms.actions : undefined) ??
    (state.user ? state.user.actions : undefined) ??
    [];

  const allowedActions = new Set(
    _extractActions(rawActs)
      .map(_normalizeActionName)
      .filter(Boolean)
  );

  // Helper: cek izin action
  const canAction = (action) => {
    const a = _normalizeActionName(action);
    if (!a) return true;

    // ✅ ADMIN selalu boleh sync semua scope
    if (role === 'ADMIN') return true;

    // Jika backend belum kirim perms → jangan mengunci total
    if (!allowedActions.size) return true;

    // dukung wildcard (jika suatu saat dipakai)
    if (allowedActions.has('*') || allowedActions.has('all')) return true;

    return allowedActions.has(a);
  };

  const scopeBox = h('div',{class:'grid md:grid-cols-2 gap-2'},
    scopes
      .filter(s=> !s.adminOnly || role==='ADMIN')
      .map(s=>{
        const allowed = canAction(s.action) && (!s.adminOnly || role==='ADMIN');
        const disabled = !allowed;

        return h('label',{
          class:'flex items-start gap-2 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-950/40 ' + (disabled?'opacity-60':'')
        },[
          h('input',{type:'checkbox', id:'sc_'+s.key, checked: !!allowed, disabled: !!disabled, class:'mt-1'}),
          h('div',{class:'min-w-0'},[
            h('div',{class:'text-sm'}, s.label),
            disabled ? h('div',{class:'text-[11px] text-slate-500 dark:text-slate-400 mt-0.5'},'Tidak diizinkan untuk role ini') : null,
          ])
        ]);
      })
  );

  const adminEstateSel = (role==='ADMIN') ? h('div',{class:'mt-3'},[
    h('label',{class:'text-sm text-slate-600 dark:text-slate-300'},'Filter Estate (opsional)'),
    h('select',{id:'sync_estate', class:'mt-1 w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-3 text-sm'},[
      h('option',{value:''},'-- Semua estate (master data) --'),
      ...estates.map(code=>h('option',{value:code},code))
    ])
  ]) : null;

  v.appendChild(card([
    h('div',{class:'font-semibold'},'Scope data yang disinkronkan'),
    h('div',{class:'mt-3'}, scopeBox),
    adminEstateSel,
    h('div',{class:'mt-4 flex flex-wrap gap-2'},[
      h('button',{id:'btn_pull', class:'rounded-2xl px-4 py-2 bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 text-sm'},'Tarik data (Pull)'),
      h('button',{id:'btn_push', class:'rounded-2xl px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700 text-sm'},'Kirim antrian (Push)'),
      h('button',{id:'btn_both', class:'rounded-2xl px-4 py-2 border border-slate-200 dark:border-slate-800 text-sm'},'Pull + Push'),
      h('button',{id:'btn_refresh_sync', class:'rounded-2xl px-4 py-2 border border-slate-200 dark:border-slate-800 text-sm'},'Refresh halaman'),
    ]),
  ]));

  // Progress UI
  const prog = h('div',{class:'mt-4'},[
    h('div',{class:'text-sm font-medium'},'Progress'),
    h('div',{class:'mt-2 w-full h-3 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden'},[
      h('div',{id:'sync_bar', class:'h-3 bg-emerald-600', style:'width:0%'}),
    ]),
    h('div',{id:'sync_label', class:'mt-2 text-xs text-slate-500 dark:text-slate-400'},'Siap'),
    h('pre',{id:'sync_log', class:'mt-3 text-[11px] whitespace-pre-wrap rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-950/40 p-3 max-h-64 overflow-auto'},''),
  ]);
  v.appendChild(prog);

  const setProgress = (pct, label, appendLog=true) => {
    const bar = document.getElementById('sync_bar');
    const lab = document.getElementById('sync_label');
    const log = document.getElementById('sync_log');
    if (bar) bar.style.width = Math.max(0, Math.min(100, pct)) + '%';
    if (lab) lab.textContent = label || '';
    if (appendLog && log) log.textContent += (label || '') + '\n';
  };

  const getSelectedScopes = ()=>{
    return scopes
      .filter(s=> (!s.adminOnly || role==='ADMIN'))
      .filter(s=> {
        const el = document.getElementById('sc_'+s.key);
        if (!el) return false;
        if (el.disabled) return false;
        return !!el.checked;
      })
      .map(s=>s);
  };
  async function doPull_() {
    const selected = getSelectedScopes();
    const estateFilter = (role==='ADMIN') ? (document.getElementById('sync_estate')?.value || '').trim().toUpperCase() : '';
    if (selected.some(s=>s.needsProgram) && (!pid || pid==='__ALL__')) {
      toast('Pilih program tertentu (bukan "Semua Program") untuk sync data program.', 'error');
      return;
    }

    setProgress(0, 'Mulai pull…');
    const steps = selected.length || 1;
    let done = 0;

    const step = async (label, fn) => {
      setProgress(Math.round((done/steps)*100), label);
      const r = await fn();
      done += 1;
      setProgress(Math.round((done/steps)*100), label + ' ✓');
      return r;
    };

    let mpDone = false;
    for (const s of selected) {
      if (s.key === 'programs') {
        await step('Pull Programs…', async ()=>{
          const r = await callApi('listPrograms', {});
          if (!r.ok) throw new Error(r.error||'Gagal listPrograms');
          const rows = normalizeRows_(r.programs||[], 'program_id');
          await cacheReplace('programs', rows, { estate: estateFilter || '' });
          return true;
        });
      }

      if (s.key === 'master_estates') {
        await step('Pull MasterEstates…', async ()=>{
          const r = await callApi('listMasterEstates', {});
          if (!r.ok) throw new Error(r.error||'Gagal listMasterEstates');
          let items = r.items || r.estates || [];
          if (estateFilter) items = items.filter(x=> String(x.estate_code||'').toUpperCase()===estateFilter);
          await cacheReplace('master_estates', items.map(x=>({ id:String(x.estate_code||''), data:x })), { estate: estateFilter || '' });
          return true;
        });
      }

      if (s.key === 'users') {
        await step('Pull Users…', async ()=>{
          const r = await callApi('listUsers', {});
          if (!r.ok) throw new Error(r.error||'Gagal listUsers');
          const items = r.items || [];
          await cacheReplace('users', items.map(x=>({ id:String(x.user_id||x.nik||''), data:x })), { estate: estateFilter || '' });
          return true;
        });
      }

      if (s.key === 'settings') {
        await step('Pull Settings…', async ()=>{
          // admin: pull global + per-estate if filter set
          const estatesToPull = estateFilter ? [estateFilter] : (estates.length ? estates : ['']);
          const rows = [];
          for (const code of estatesToPull) {
            const r = await callApi('getSettings', code ? { estate: code } : {});
            if (!r.ok) throw new Error(r.error||'Gagal getSettings');
            const sid = 'settings:' + (code || '__GLOBAL__');
            rows.push({ id: sid, data: Object.assign({ __estate: code || '' }, (r.settings||{})) });
          }
          await cacheReplace('settings', rows, { estate: estateFilter || '' });
          return true;
        });
      }

      if (s.key === 'candidates') {
        await step('Pull Candidates…', async ()=>{
          const r = await callApi('listCandidates', { program_id: pid });
          if (!r.ok) throw new Error(r.error||'Gagal listCandidates');
          await cacheReplace('candidates', normalizeRows_(r.candidates||[], 'candidate_id'), { program_id: pid });
          return true;
        });
      }

      if (s.key === 'selection') {
        await step('Pull Selection…', async ()=>{
          const r = await callApi('listSelection', { program_id: pid });
          if (!r.ok) throw new Error(r.error||'Gagal listSelection');
          const items = r.items || [];
          await cacheReplace('selection', items.map(x=>({ id:String(x.candidate_id||x.selection_id||''), data:x })), { program_id: pid });
          return true;
        });
      }

      if (s.key === 'participants') {
        await step('Pull Participants…', async ()=>{
          const r = await callApi('listParticipants', { program_id: pid });
          if (!r.ok) throw new Error(r.error||'Gagal listParticipants');
          await cacheReplace('participants', normalizeRows_(r.participants||[], 'participant_id'), { program_id: pid });
          return true;
        });
      }

      if ((s.key === 'mentors' || s.key === 'pairings') && !mpDone) {
        // listMentors contains both mentors & pairings
        await step('Pull Mentors & Pairings…', async ()=>{
          const r = await callApi('listMentors', { program_id: pid });
          if (!r.ok) throw new Error(r.error||'Gagal listMentors');
          if (document.getElementById('sc_mentors')?.checked) {
            await cacheReplace('mentors', normalizeRows_(r.mentors||[], 'mentor_id'), { program_id: pid });
          }
          if (document.getElementById('sc_pairings')?.checked) {
            await cacheReplace('pairings', normalizeRows_(r.pairings||[], 'pairing_id'), { program_id: pid });
          }
          return true;
        });
        mpDone = true;
      }

      if (s.key === 'daily_logs') {
        await step('Pull DailyLogs…', async ()=>{
          const r = await callApi('getDailyLogs', { program_id: pid, date:'', q:'' });
          if (!r.ok) throw new Error(r.error||'Gagal getDailyLogs');
          const rows = normalizeRows_(r.logs||[], 'log_id').filter(x=>String(x.id||''));
          await cacheReplace('daily_logs', rows, { program_id: pid });
          return true;
        });
      }

      if (s.key === 'graduations') {
        await step('Pull Graduations…', async ()=>{
          const r = await callApi('listGraduation', {});
          if (!r.ok) throw new Error(r.error||'Gagal listGraduation');
          await cacheReplace('graduations', (r.items||[]).map(x=>({ id:String(x.participant_id||x.grad_id||''), data:x })), { program_id: pid });
          return true;
        });
      }

      if (s.key === 'certificates') {
        await step('Pull Certificates…', async ()=>{
          const r = await callApi('listCertificates', {});
          if (!r.ok) throw new Error(r.error||'Gagal listCertificates');
          await cacheReplace('certificates', (r.items||[]).map(x=>({ id:String(x.cert_id||x.certificate_no||''), data:x })), { program_id: pid });
          return true;
        });
      }

      if (s.key === 'incentives') {
        await step('Pull Incentives…', async ()=>{
          const r = await callApi('listMentorIncentives', {});
          if (!r.ok) throw new Error(r.error||'Gagal listMentorIncentives');
          await cacheReplace('incentives', (r.items||[]).map(x=>({ id:String(x.incentive_id||''), data:x })), { program_id: pid });
          return true;
        });
      }
    }

    setProgress(100, 'Pull selesai ✅');
    toast('Pull selesai', 'ok');
  }

  async function doPush_() {
    const items = await outboxList();
    if (!items.length) {
      toast('Outbox kosong', 'info');
      setProgress(100, 'Tidak ada antrian');
      return;
    }
    setProgress(0, 'Mulai push…');
    const steps = items.length;
    let done = 0;

    for (const it of items) {
      const label = `Push ${it.action}…`;
      setProgress(Math.round((done/steps)*100), label);
      try {
        const r = await callApi(it.action, it.payload || {});
        if (!r.ok) throw new Error(r.error||'Gagal');
        await outboxRemove(it.id);
        done += 1;
        setProgress(Math.round((done/steps)*100), label + ' ✓');
      } catch (e) {
        setProgress(Math.round((done/steps)*100), label + ' ✗ ' + (e.message||e), true);
        toast('Push berhenti: ' + (e.message||e), 'error');
        return;
      }
    }

    setProgress(100, 'Push selesai ✅');
    toast('Push selesai', 'ok');
  }

  document.getElementById('btn_pull').onclick = async ()=>{
    btnBusy(document.getElementById('btn_pull'), true, 'Pull…');
    try{ await doPull_(); } finally { btnBusy(document.getElementById('btn_pull'), false, 'Tarik data (Pull)'); }
  };
  document.getElementById('btn_push').onclick = async ()=>{
    btnBusy(document.getElementById('btn_push'), true, 'Push…');
    try{ await doPush_(); } finally { btnBusy(document.getElementById('btn_push'), false, 'Kirim antrian (Push)'); }
  };
  document.getElementById('btn_both').onclick = async ()=>{
    btnBusy(document.getElementById('btn_both'), true, 'Sync…');
    try{ await doPull_(); await doPush_(); } finally { btnBusy(document.getElementById('btn_both'), false, 'Pull + Push'); }
  };
  document.getElementById('btn_refresh_sync').onclick = ()=>renderSync();
}

boot();
