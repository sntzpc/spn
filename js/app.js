import { CONFIG } from './config.js';
import { callApi, callApiPost } from './api.js';
import { toast, btnBusy, h, formatDateISO, formatDateLongID, formatDateDMYID, isoToDMY, dmyToISO, todayDMY } from './ui.js';

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
  const common = [{ key:'dashboard', label:'Dashboard', icon:'📊' }];
  const admin = [
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
  const asisten = [
    { key:'participants', label:'Peserta', icon:'👷' },
    { key:'mentors', label:'Pairing', icon:'🤝' },
    { key:'monitoring', label:'Monitoring', icon:'📝' },
    { key:'settings', label:'Ganti PIN', icon:'⚙️' },
  ];
  const mandor = [
    { key:'monitoring', label:'Monitoring Harian', icon:'📝' },
    { key:'participants', label:'Peserta', icon:'👷' },
    { key:'settings', label:'Ganti PIN', icon:'⚙️' },
  ];
  const mentor = [
    { key:'mymentee', label:'Mentee Saya', icon:'🤝' },
    { key:'monitoring', label:'Log Harian', icon:'📝' },
    { key:'settings', label:'Ganti PIN', icon:'⚙️' },
  ];
  if (role === 'ADMIN') return [...common, ...admin];
  if (role === 'ASISTEN') return [...common, ...asisten];
  if (role === 'MANDOR') return [...common, ...mandor];
  if (role === 'MENTOR') return [...common, ...mentor];
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

async function boot() {
  applyThemeFromStorage();
  const token = localStorage.getItem(CONFIG.TOKEN_KEY) || '';
  if (!token) return renderLogin();

  try {
    const me = await callApi('me', {});
    if (!me.ok) throw new Error(me.error || 'Session invalid');
    state.user = me.user;
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
    // 1) ambil dari localStorage kalau masih valid
    // 2) fallback ke program aktif untuk estate user
    const stored = (localStorage.getItem(CONFIG.PROGRAM_KEY) || '').trim();
    const role = String(state.user?.role || '').toUpperCase();
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
    ...(String(role||'').toUpperCase()==='ADMIN'
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
    if (String(role||'').toUpperCase()==='ADMIN') {
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

async function renderDashboard() {
  const selected = state.programs.find(x => String(x.program_id||'') === String(currentProgramId_()||'')) || null;
  const subtitle = selected
    ? `Context program: ${selected.name} • ${(selected.status||'').toUpperCase()} • ${formatDateDMYID(selected.period_start||'')}`
    : (state.program ? `Default: ${state.program.name} • ${(state.program.status||'').toUpperCase()} • ${formatDateDMYID(state.program.period_start||'')}` : 'Default: (belum diset)');

  const v = setViewTitle('Dashboard', subtitle);

  // Admin: overview semua program + mapping aktif per estate (drilldown)
  if ((state.user?.role||'').toUpperCase() === 'ADMIN') {
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
  if (!res.ok) return v.appendChild(card([h('div',{class:'text-rose-600'}, res.error || 'Gagal load dashboard')]));

  const s = res.stats || {};
  const cards = [
    { key:'candidates', label:'Calon', value: s.candidates||0, hint:'Klik untuk lihat daftar', icon:'🧾' },
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
    options: { responsive:true, plugins:{ legend:{ position:'bottom' } } }
  });

  barEl._chart = new Chart(barEl, {
    type: 'bar',
    data: { labels: dl.labels || [], datasets: [{ label: 'Log', data: dl.values || [] }] },
    options: { responsive:true, plugins:{ legend:{ display:false } }, scales:{ y:{ beginAtZero:true } } }
  });
}

async function openDashboardDetail(type, title){
  const overlay = h('div', { class:'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40' }, []);
  const holder = h('div',{class:'mt-4'},[h('div',{class:'text-sm text-slate-500'},'Memuat...')]);
  const modal = card([
    h('div',{class:'flex items-start justify-between gap-2'},[
      h('div',{},[
        h('div',{class:'text-lg font-semibold'}, title),
        h('div',{class:'text-xs text-slate-500 dark:text-slate-400 mt-1'},'Klik di luar untuk menutup')
      ]),
      h('button',{class:'rounded-xl px-3 py-2 text-sm border border-slate-200 dark:border-slate-800', onclick:()=>overlay.remove()},'Tutup')
    ]),
    holder
  ]);
  modal.classList.add('w-full','max-w-4xl');
  overlay.appendChild(modal);
  overlay.addEventListener('click', (e)=>{ if(e.target===overlay) overlay.remove(); });
  document.body.appendChild(overlay);

  const r = await callApi('dashboardDetail', { type, program_id: currentProgramId_() || '' });
  if (!r.ok) {
    holder.innerHTML = '';
    holder.appendChild(h('div',{class:'text-rose-600'}, r.error||'Gagal'));
    return;
  }
  const items = r.items || [];
  holder.innerHTML = '';
  if (!items.length) return holder.appendChild(h('div',{class:'text-slate-500'}, 'Tidak ada data'));

  // simple table based on type
  if (type === 'alerts') {
    holder.appendChild(table(['NIK','Nama','Kategori'], items.map(x=>[x.nik||'-', x.name||'-', x.category||'-'])));
  } else if (type === 'candidates') {
    holder.appendChild(table(['NIK','Nama','Status','Updated'], items.map(x=>[x.nik||'-', x.name||'-', x.status||'-', (x.updated_at||x.created_at||'')])));
  } else if (type === 'participants') {
    holder.appendChild(table(['NIK','Nama','Kategori','Status','Mentor'], items.map(x=>[x.nik||'-', x.name||'-', x.category||'-', x.status||'-', x.mentor_id||'-'])));
  } else if (type === 'mentors') {
    holder.appendChild(table(['NIK','Nama','Status'], items.map(x=>[x.nik||'-', x.name||'-', x.status||'-'])));
  } else {
    holder.appendChild(h('pre',{class:'text-xs whitespace-pre-wrap'}, JSON.stringify(items.slice(0,100),null,2)));
  }
}

async function renderPrograms() {
  const v = setViewTitle('Program', 'Kelola batch Sekolah Pemanen');
  const res = await callApi('listPrograms', {});
  if (res.ok) { state.programs = res.programs || []; state.program = res.activeProgram || null; state.estates = res.estates || state.estates || []; }
  const top = h('div', { class:'flex flex-col md:flex-row md:items-center gap-3 mb-4' }, [
    h('div', { class:'text-sm text-slate-500 dark:text-slate-400' }, 'Pilih program aktif untuk operasional harian.'),
    h('div', { class:'md:ml-auto flex gap-2' }, [
      h('button', { id:'btnNewProgram', class:'rounded-2xl px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700 text-sm' }, 'Buat Program'),
      h('button', { class:'rounded-2xl px-4 py-2 border border-slate-200 dark:border-slate-800 text-sm', onclick: ()=>preload().then(()=>renderPrograms()) }, 'Refresh')
    ])
  ]);
  v.appendChild(top);

  // Admin: set active program per estate (parallel multi-estate)
  if ((state.user?.role||'').toUpperCase() === 'ADMIN') {
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
    // - DRAFT => Jadikan Aktif
    // - ACTIVE => Tutup
    // - else => (none)
    const actionEl = (()=>{
      if (st === 'DRAFT') {
        return h('button', {
          class:'rounded-xl px-3 py-2 text-xs bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900',
          onclick: async ()=>{
            const estate_code = (state.user?.role||'').toUpperCase()==='ADMIN'
              ? String((document.getElementById('adminEstateSel') && document.getElementById('adminEstateSel').value) || state.myEstate || '').trim().toUpperCase()
              : String(state.myEstate||'').trim().toUpperCase();
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

  document.getElementById('btnNewProgram').onclick = () => openProgramModal();
}

function openProgramModal() {
  const v = document.getElementById('view');
  const overlay = h('div', { class:'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40' }, []);
  const modal = card([
    h('div',{class:'text-lg font-semibold'},'Buat Program Baru'),
    h('div',{class:'mt-4 grid md:grid-cols-2 gap-3'},[
      field('Nama Program','name','Sekolah Pemanen - Batch 01'),
      field('Lokasi','location','Estate / TC'),
      field('Mulai (YYYY-MM-DD)','period_start', formatDateISO(new Date())),
      field('Selesai (YYYY-MM-DD)','period_end', ''),
      field('Kuota','quota','30'),
    ]),
    h('div',{class:'mt-5 flex justify-end gap-2'},[
      h('button',{class:'rounded-2xl px-4 py-2 text-sm border border-slate-200 dark:border-slate-800', onclick:()=>overlay.remove()},'Batal'),
      h('button',{id:'btnSaveProgram', class:'rounded-2xl px-4 py-2 text-sm bg-emerald-600 text-white hover:bg-emerald-700 flex items-center gap-2'},[
        h('span',{'data-spinner':'', class:'hidden w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin'}),
        h('span',{'data-label':'','data-orig':'Simpan'},'Simpan')
      ])
    ])
  ]);
  modal.classList.add('w-full','max-w-2xl');
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  document.getElementById('btnSaveProgram').onclick = async ()=>{
    const btn = document.getElementById('btnSaveProgram');
    const payload = {
      name: val('name'),
      location: val('location'),
      period_start: val('period_start'),
      period_end: val('period_end'),
      quota: val('quota')
    };
    btnBusy(btn,true,'Menyimpan...');
    try{
      const r = await callApi('createProgram', payload);
      if(!r.ok) throw new Error(r.error||'Gagal');
      toast('Program dibuat', 'ok');
      overlay.remove();
      await preload();
      renderPrograms();
    }catch(e){
      toast(e.message,'error');
    }finally{
      btnBusy(btn,false,'Simpan');
    }
  };

  function field(label,id,ph){
    return h('div',{},[
      h('label',{class:'text-sm text-slate-600 dark:text-slate-300'},label),
      h('input',{id, placeholder:ph||'', class:'mt-1 w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500'})
    ]);
  }
  function val(id){ return (document.getElementById(id).value||'').trim(); }
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
  const res = await callApi('listCandidates', { program_id: currentProgramId_() });
  if (res.ok) state.candidates = res.candidates || [];
  const actions = h('div',{class:'flex gap-2 mb-4'},[
    h('button',{class:'rounded-2xl px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700 text-sm', onclick:()=>openCandidateModal()},'Tambah Calon'),
    h('button',{class:'rounded-2xl px-4 py-2 border border-slate-200 dark:border-slate-800 text-sm', onclick:()=>renderCandidates()},'Refresh'),
  ]);
  v.appendChild(actions);

  const rows = state.candidates.map(c => ([
    c.nik,
    c.name,
    `${(c.estate||'-').toUpperCase()} / ${c.divisi||'-'}`,
    `${c.family_id||'-'} • ${c.relation||'-'}`,
    badge(c.admin_status || 'SUBMITTED'),
    c.applied_at ? formatDateDMYID(c.applied_at) : '-',
    docsBadge_(c),
    h('div',{class:'flex flex-wrap gap-2'},[
      h('button',{class:'rounded-xl px-3 py-2 text-xs border border-slate-200 dark:border-slate-800', onclick:()=>openCandidateModal(c)},'Edit'),
      h('button',{class:'rounded-xl px-3 py-2 text-xs bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900', onclick:()=>verifyCandidate(c,'VERIFIED')},'Verifikasi'),
      h('button',{class:'rounded-xl px-3 py-2 text-xs bg-rose-600 text-white', onclick:()=>verifyCandidate(c,'REJECTED')},'Tolak'),
    ])
  ]));
  v.appendChild(card([table(['NIK','Nama','Estate/Divisi','Keluarga','Status','Apply','Berkas','Aksi'], rows)]));
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
  const r = await callApi('verifyCandidate', { candidate_id: c.candidate_id, admin_status: status, admin_notes: notes||'' });
  if (!r.ok) return toast(r.error||'Gagal', 'error');
  toast('Status diperbarui', 'ok');
  renderCandidates();
}

function openCandidateModal(cand=null) {
  const overlay = h('div', { class:'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40' }, []);
  const modal = card([
    h('div',{class:'text-lg font-semibold'}, cand ? 'Edit Calon' : 'Tambah Calon'),
    h('div',{class:'mt-4 grid md:grid-cols-3 gap-3'},[
      f('NIK','nik','contoh: 202602001'),
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
      ])
    ]),
    h('div',{class:'mt-5 flex justify-end gap-2'},[
      h('button',{class:'rounded-2xl px-4 py-2 text-sm border border-slate-200 dark:border-slate-800', onclick:()=>overlay.remove()},'Batal'),
      h('button',{id:'btnSaveCandidate', class:'rounded-2xl px-4 py-2 text-sm bg-emerald-600 text-white hover:bg-emerald-700 flex items-center gap-2'},[
        h('span',{'data-spinner':'', class:'hidden w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin'}),
        h('span',{'data-label':'','data-orig':'Simpan'},'Simpan')
      ])
    ])
  ]);
  modal.classList.add('w-full','max-w-3xl');
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

    // ===========================
  // FAMILY PAIRING UI LOGIC
  // ===========================
  const relEl = document.getElementById('relation');
  const famEl = document.getElementById('family_id');
  const wrapEl = document.getElementById('partner_wrap');
  const partnerEl = document.getElementById('partner_candidate_id');

  // set default values
  relEl.value = (cand?.relation || 'INDIVIDU').toUpperCase();
  famEl.value = (cand?.family_id || '').trim();

  // isi dropdown pasangan dari state.candidates (program yang sama)
  const all = (state.candidates || []).filter(x => x.candidate_id && x.candidate_id !== cand?.candidate_id);
  all.forEach(x => {
    const label = `${(x.nik||'').trim()} • ${(x.name||'').trim()}${x.family_id ? ' • ' + x.family_id : ''}`;
    partnerEl.appendChild(h('option',{value:x.candidate_id}, label));
  });

  // jika edit dan sudah punya family_id, coba pilih pasangan otomatis (yang 1 family_id)
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
      // jika pasangan dipilih dan dia punya family_id → tampilkan
      const pid = partnerEl.value;
      const p = all.find(x => x.candidate_id === pid);
      if (p && (p.family_id||'').trim()) {
        famEl.value = (p.family_id||'').trim();
      } else if (!famEl.value) {
        // buat sementara di UI (backend tetap otoritatif)
        famEl.value = ('FAM-' + String(Date.now()).slice(-8)).toUpperCase();
      }
    } else {
      wrapEl.classList.add('hidden');
      partnerEl.value = '';
      // jika relation INDIVIDU, biarkan family_id tampil (kalau sebelumnya ada) sampai user simpan
      // user bisa "lepas pasangan" saat save (lihat __clear_family)
    }
  }

  relEl.addEventListener('change', refreshPartnerUI_);
  partnerEl.addEventListener('change', refreshPartnerUI_);
  refreshPartnerUI_();

  if (cand) {
    ['nik','estate','divisi','family_id','relation','name','gender','dob','phone','education','source'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value = cand[id] || ''; });
    document.getElementById('address').value = cand.address || '';
  }

  // disable uploads until candidate_id exists
  const hasId = !!(cand && cand.candidate_id);
  Array.from(modal.querySelectorAll('input[type="file"]')).forEach(inp=>{
    inp.disabled = !hasId;
  });

  document.getElementById('btnSaveCandidate').onclick = async ()=>{
    const btn = document.getElementById('btnSaveCandidate');
    btnBusy(btn,true,'Menyimpan...');
    try{

      // ✅ VALIDASI WAJIB PASANGAN (taruh di sini)
    const rel = (document.getElementById('relation').value || 'INDIVIDU').toUpperCase();
    const need = ['SUAMI','ISTRI','SAUDARA','TANDEM'].includes(rel);
    const pid  = (document.getElementById('partner_candidate_id')?.value || '').trim();
    if (need && !pid) {
      toast('Relation ' + rel + ' wajib pilih pasangan', 'error');
      return;
    }
    const payload = {
        candidate_id: cand?.candidate_id || '',
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

        // ✅ kirim juga link dokumen yang sudah ada agar tidak kosong saat Simpan
        docs_ktp: (cand?.docs_ktp || '').trim(),
        docs_kk: (cand?.docs_kk || '').trim(),
        docs_skck: (cand?.docs_skck || '').trim(),
        docs_health: (cand?.docs_health || '').trim(),
        photo_url: (cand?.photo_url || '').trim(),
      };
      const r = await callApi('upsertCandidate', Object.assign({ program_id: currentProgramId_() }, payload));
      if(!r.ok) throw new Error(r.error||'Gagal');
      toast('Tersimpan', 'ok');
      // If creating new candidate, keep modal open and enable uploads
      if (!cand?.candidate_id) {
        cand = Object.assign({}, payload, { candidate_id: r.candidate_id });
        document.getElementById('uploadHint').textContent = 'Sekarang Anda bisa upload berkas.';
        Array.from(modal.querySelectorAll('input[type="file"]')).forEach(inp=>{ inp.disabled = false; });
        // refresh list in background
        renderCandidates();
        return;
      }
      overlay.remove();
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
  const v = setViewTitle('Seleksi Lapangan', 'Input nilai fisik, uji panen, karakter & kategori A/B/C');
  const res = await callApi('listSelection', { program_id: currentProgramId_() });
  if (!res.ok) return v.appendChild(card([h('div',{class:'text-rose-600'}, res.error||'Gagal')]));
  const items = res.items || [];
  v.appendChild(card([
    table(['NIK','Nama','Admin','Rekom','Final','Aksi'], items.map(it=>[
      it.nik, it.name, badge(it.admin_status||'-'), badge(it.recommend_category||'-'), badge(it.final_category||'-'),
      h('button',{class:'rounded-xl px-3 py-2 text-xs bg-emerald-600 text-white', onclick:()=>openSelectionModal(it)}, 'Input/Update')
    ]))
  ]));
}

function openSelectionModal(it) {
  const overlay = h('div', { class:'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40' }, []);
  const modal = card([
    h('div',{class:'text-lg font-semibold'},`Seleksi: ${it.name} (${it.nik})`),
    h('div',{class:'mt-4 grid md:grid-cols-3 gap-3'},[
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
    ]),
    h('div',{class:'mt-5 flex justify-end gap-2'},[
      h('button',{class:'rounded-2xl px-4 py-2 text-sm border border-slate-200 dark:border-slate-800', onclick:()=>overlay.remove()},'Batal'),
      h('button',{id:'btnSaveSel', class:'rounded-2xl px-4 py-2 text-sm bg-emerald-600 text-white hover:bg-emerald-700 flex items-center gap-2'},[
        h('span',{'data-spinner':'', class:'hidden w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin'}),
        h('span',{'data-label':'','data-orig':'Simpan'},'Simpan')
      ])
    ])
  ]);
  modal.classList.add('w-full','max-w-3xl');
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

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
      const r = await callApi('submitSelection', Object.assign({ program_id: currentProgramId_() }, payload));
      if(!r.ok) throw new Error(r.error||'Gagal');
      toast('Seleksi tersimpan', 'ok');
      overlay.remove();
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
  const v = setViewTitle('Peserta', 'Daftar peserta aktif (A/B) per program');
  const res = await callApi('listParticipants', { program_id: currentProgramId_() });
  if (res.ok) state.participants = res.participants || [];
  const top = h('div',{class:'flex gap-2 mb-4'},[
    h('button',{class:'rounded-2xl px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700 text-sm', onclick:async ()=>{
      const r = await callApi('generateParticipantsFromSelection', { program_id: currentProgramId_() });
      if (!r.ok) return toast(r.error||'Gagal', 'error');
      toast(`Generate selesai: +${r.created||0}`, 'ok');
      renderParticipants();
    }},'Generate dari Seleksi (A/B)'),
    h('button',{class:'rounded-2xl px-4 py-2 border border-slate-200 dark:border-slate-800 text-sm', onclick:()=>renderParticipants()},'Refresh'),
  ]);
  v.appendChild(top);

  v.appendChild(card([
    table(['NIK','Nama','Cat','Status','Mentor','Aksi'], state.participants.map(p=>[
      p.nik, p.name, badge(p.category||'-'), badge(p.status||'-'), p.mentor_name || '-',
      h('button',{class:'rounded-xl px-3 py-2 text-xs border border-slate-200 dark:border-slate-800', onclick:()=>openPlacementModal(p)},'Penempatan')
    ]))
  ]));
}

function openPlacementModal(p) {
  const overlay = h('div', { class:'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40' }, []);
  const modal = card([
    h('div',{class:'text-lg font-semibold'},`Penempatan: ${p.name}`),
    h('div',{class:'mt-4 grid md:grid-cols-3 gap-3'},[
      field('Estate','estate', p.estate||''),
      field('Divisi','divisi', p.divisi||''),
      field('Ancak','ancak', p.ancak||''),
    ]),
    h('div',{class:'mt-5 flex justify-end gap-2'},[
      h('button',{class:'rounded-2xl px-4 py-2 text-sm border border-slate-200 dark:border-slate-800', onclick:()=>overlay.remove()},'Batal'),
      h('button',{id:'btnSavePlace', class:'rounded-2xl px-4 py-2 text-sm bg-emerald-600 text-white hover:bg-emerald-700 flex items-center gap-2'},[
        h('span',{'data-spinner':'', class:'hidden w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin'}),
        h('span',{'data-label':'','data-orig':'Simpan'},'Simpan')
      ])
    ])
  ]);
  modal.classList.add('w-full','max-w-2xl');
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  document.getElementById('btnSavePlace').onclick = async ()=>{
    const btn = document.getElementById('btnSavePlace');
    btnBusy(btn,true,'Menyimpan...');
    try{
      const r = await callApi('setPlacement', {
        participant_id: p.participant_id,
        estate: val('estate'),
        divisi: val('divisi'),
        ancak: val('ancak'),
      });
      if(!r.ok) throw new Error(r.error||'Gagal');
      toast('Penempatan tersimpan', 'ok');
      overlay.remove();
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
  const v = setViewTitle('Mentor & Pairing', 'Kelola mentor dan pairing 1-on-1 untuk peserta kategori B');
  const res = await callApi('listMentors', { program_id: currentProgramId_() });
  if (res.ok) { state.mentors = res.mentors||[]; state.pairings = res.pairings||[]; }
  const top = h('div',{class:'flex flex-col md:flex-row gap-2 mb-4'},[
    h('button',{class:'rounded-2xl px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700 text-sm', onclick:()=>openMentorModal()},'Tambah Mentor'),
    h('button',{class:'rounded-2xl px-4 py-2 border border-slate-200 dark:border-slate-800 text-sm', onclick:()=>openPairingModal()},'Assign Pairing'),
    h('button',{class:'rounded-2xl px-4 py-2 border border-slate-200 dark:border-slate-800 text-sm', onclick:()=>renderMentors()},'Refresh'),
  ]);
  v.appendChild(top);

  v.appendChild(h('div',{class:'grid md:grid-cols-2 gap-4'},[
    card([
      h('div',{class:'font-semibold mb-3'},'Mentor'),
      table(['NIK','Nama','Estate','Aktif'], state.mentors.map(m=>[
        m.nik, m.name, m.estate||'-', badge(m.active||'TRUE')
      ]))
    ]),
    card([
      h('div',{class:'font-semibold mb-3'},'Pairing'),
      table(['Mentor','Mentee','Status','Mulai'], state.pairings.map(p=>[
        p.mentor_name||'-', p.participant_name||'-', badge(p.status||'-'), (p.start_date ? formatDateLongID(p.start_date, 'Asia/Jakarta') : '-')
      ]))
    ])
  ]));
}

function openMentorModal(m=null) {
  const overlay = h('div', { class:'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40' }, []);
  const modal = card([
    h('div',{class:'text-lg font-semibold'}, m?'Edit Mentor':'Tambah Mentor'),
    h('div',{class:'mt-4 grid md:grid-cols-2 gap-3'},[
      f('NIK','m_nik',''),
      f('Nama','m_name',''),
      f('Estate','m_estate',''),
      f('Divisi','m_divisi',''),
      f('Pengalaman (tahun)','m_exp',''),
    ]),
    h('div',{class:'mt-5 flex justify-end gap-2'},[
      h('button',{class:'rounded-2xl px-4 py-2 text-sm border border-slate-200 dark:border-slate-800', onclick:()=>overlay.remove()},'Batal'),
      h('button',{id:'btnSaveMentor', class:'rounded-2xl px-4 py-2 text-sm bg-emerald-600 text-white hover:bg-emerald-700 flex items-center gap-2'},[
        h('span',{'data-spinner':'', class:'hidden w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin'}),
        h('span',{'data-label':'','data-orig':'Simpan'},'Simpan')
      ])
    ])
  ]);
  modal.classList.add('w-full','max-w-2xl');
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  document.getElementById('btnSaveMentor').onclick = async ()=>{
    const btn = document.getElementById('btnSaveMentor');
    btnBusy(btn,true,'Menyimpan...');
    try{
      const r = await callApi('upsertMentor', {
        mentor_id: m?.mentor_id || '',
        nik: val('m_nik'),
        name: val('m_name'),
        estate: val('m_estate'),
        divisi: val('m_divisi'),
        experience_years: val('m_exp')
      });
      if(!r.ok) throw new Error(r.error||'Gagal');
      toast('Mentor tersimpan','ok');
      overlay.remove();
      renderMentors();
    }catch(e){ toast(e.message,'error'); }
    finally{ btnBusy(btn,false,'Simpan'); }
  };

  function f(label,id,ph){
    return h('div',{},[
      h('label',{class:'text-sm text-slate-600 dark:text-slate-300'},label),
      h('input',{id, placeholder:ph||'', class:'mt-1 w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500'})
    ]);
  }
  function val(id){ return (document.getElementById(id).value||'').trim(); }
}

async function openPairingModal() {
  // load peserta B + mentors fresh (pakai program context!)
  const pr = await callApi('listParticipants', { program_id: currentProgramId_() });
  if (pr.ok) state.participants = pr.participants || [];
  const bList = state.participants.filter(p => String(p.category || '').toUpperCase() === 'B');

  const overlay = h('div', { class:'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40' }, []);
  const modal = card([
    h('div',{class:'text-lg font-semibold'},'Assign Pairing Mentor–Mentee'),

    h('div',{class:'mt-4 grid md:grid-cols-2 gap-3'},[
      h('div',{},[
        h('label',{class:'text-sm text-slate-600 dark:text-slate-300'},'Mentor'),
        select('pair_mentor', state.mentors.map(m=>({value:m.mentor_id, label:`${m.name} (${m.nik})`})))
      ]),
      h('div',{},[
        h('label',{class:'text-sm text-slate-600 dark:text-slate-300'},'Peserta (Kategori B)'),
        select('pair_participant', bList.map(p=>{
          const nm = String(p.name||'').trim();
          const nik = String(p.nik||'').trim();
          const cid = String(p.candidate_id||'').trim();
          const fam = String(p.family_id||'').trim();

          const labelBase = (nm || nik)
            ? `${nm || '(tanpa nama)'} (${nik || '-'})`
            : (cid ? `Candidate ${cid}` : '(data kosong)');

          const label = fam ? `${labelBase} • Family:${fam}` : labelBase;
          return { value:p.participant_id, label };
        }))
      ]),

      h('div',{},[
        h('label',{class:'text-sm text-slate-600 dark:text-slate-300'},'Mulai'),
        h('input',{id:'pair_start', value:formatDateISO(new Date()), class:'mt-1 w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500'})
      ]),
      h('div',{},[
        h('label',{class:'text-sm text-slate-600 dark:text-slate-300'},'Selesai (opsional)'),
        h('input',{id:'pair_end', value:'', placeholder:'YYYY-MM-DD', class:'mt-1 w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500'})
      ]),

      // ✅ Checkbox apply_family (full row)
      h('div', { class:'md:col-span-2' }, [
        h('label', { class:'flex items-center gap-2 text-sm mt-2 select-none cursor-pointer text-slate-700 dark:text-slate-200' }, [
          h('input', { id:'pair_apply_family', type:'checkbox', checked:true, class:'w-4 h-4 rounded border-slate-300 dark:border-slate-700' }),
          h('span', {}, 'Terapkan ke pasangan (family)')
        ]),
        h('div', { class:'text-xs text-slate-500 dark:text-slate-400 mt-1' },
          'Jika dicentang, anggota family_id yang sama (kategori B) akan otomatis dipairing ke mentor yang sama (jika belum punya pairing aktif).'
        )
      ]),
    ]),

    h('div',{class:'mt-5 flex justify-end gap-2'},[
      h('button',{class:'rounded-2xl px-4 py-2 text-sm border border-slate-200 dark:border-slate-800', onclick:()=>overlay.remove()},'Batal'),
      h('button',{id:'btnSavePair', class:'rounded-2xl px-4 py-2 text-sm bg-emerald-600 text-white hover:bg-emerald-700 flex items-center gap-2'},[
        h('span',{'data-spinner':'', class:'hidden w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin'}),
        h('span',{'data-label':'','data-orig':'Simpan'},'Simpan')
      ])
    ])
  ]);

  modal.classList.add('w-full','max-w-3xl');
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  document.getElementById('btnSavePair').onclick = async ()=>{
    const btn = document.getElementById('btnSavePair');
    btnBusy(btn,true,'Menyimpan...');
    try{
      const applyFamily = document.getElementById('pair_apply_family').checked ? 'TRUE' : 'FALSE';

      const r = await callApi('assignMentor', {
        program_id: currentProgramId_(),          // ✅ NEW (pakai context program UI)
        mentor_id: (document.getElementById('pair_mentor').value||'').trim(),
        participant_id: (document.getElementById('pair_participant').value||'').trim(),
        start_date: (document.getElementById('pair_start').value||'').trim(),
        end_date: (document.getElementById('pair_end').value||'').trim(),
        apply_family: applyFamily,
      });

      if(!r.ok) throw new Error(r.error||'Gagal');

      // jika backend kirim auto_applied_participant_ids, tampilkan informasinya (opsional)
      const autoN = Array.isArray(r.auto_applied_participant_ids) ? r.auto_applied_participant_ids.length : 0;
      toast(autoN ? `Pairing tersimpan + auto family ${autoN}` : 'Pairing tersimpan', 'ok');

      overlay.remove();
      renderMentors();
    }catch(e){ toast(e.message,'error'); }
    finally{ btnBusy(btn,false,'Simpan'); }
  };

  function select(id, opts){
    const s = h('select',{id, class:'mt-1 w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500'},[
      ...(opts.length?[]:[h('option',{value:''},'—')]),
      ...opts.map(o=>h('option',{value:o.value},o.label))
    ]);
    return s;
  }
}

async function renderMonitoring(){
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
        const r = await callApi('computeWeeklyRecap', { any_date: d });
        if(!r.ok) return toast(r.error||'Gagal', 'error');
        toast('Rekap mingguan dihitung/diupdate', 'ok');
      }},'Hitung Rekap Mingguan')
    ])
  ]);
  v.appendChild(top);

  const holder = h('div',{id:'mon_holder'},[]);
  v.appendChild(card([holder]));

  async function loadLogs(){
    const dDisp = (document.getElementById('mon_date').value||'').trim();
    const d = dmyToISO(dDisp);
    if(!d) return toast('Format tanggal harus dd-mm-yyyy', 'error');
    const q = (document.getElementById('mon_q').value||'').trim();
    const r = await callApi('getDailyLogs', { date: d, q });
    if(!r.ok) return toast(r.error||'Gagal', 'error');
    const items = r.logs||[];
    holder.innerHTML='';
    holder.appendChild(table(['Tanggal','Peserta','Ton','Mutu','APD','Disiplin','Catatan'], items.map(x=>[
      isoToDMY(x.date), `${x.participant_name} (${x.participant_nik})`, x.tonnage||'-', x.mutu_grade||'-', badge(x.apd_ok||'-'), x.discipline_score||'-', (x.mentor_note||x.mandor_note||x.assistant_note||'') || '-'
    ])));
  }
  await loadLogs();
}

async function openDailyLogModal() {

// Load dropdown data
let parts = [];
let mentors = [];
try {
  const pr = await callApi('lookupParticipants', (state.user?.role==='MENTOR') ? { category:'B' } : {});
  if (pr.ok) parts = pr.items||[];
  const mr = await callApi('lookupMentors', {});
  if (mr.ok) mentors = mr.items||[];
} catch (e) {}

  const overlay = h('div', { class:'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40' }, []);
  const modal = card([
    h('div',{class:'text-lg font-semibold'},'Input Log Harian'),
    h('div',{class:'mt-4 grid md:grid-cols-2 gap-3'},[
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
    ]),
    h('div',{class:'mt-5 flex justify-end gap-2'},[
      h('button',{class:'rounded-2xl px-4 py-2 text-sm border border-slate-200 dark:border-slate-800', onclick:()=>overlay.remove()},'Batal'),
      h('button',{id:'btnSaveDL', class:'rounded-2xl px-4 py-2 text-sm bg-emerald-600 text-white hover:bg-emerald-700 flex items-center gap-2'},[
        h('span',{'data-spinner':'', class:'hidden w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin'}),
        h('span',{'data-label':'','data-orig':'Simpan'},'Simpan')
      ])
    ])
  ]);
  modal.classList.add('w-full','max-w-3xl');
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

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
      const r = await callApi('submitDailyLog', {
        participant_id: v('dl_participant'),
        date: dateIso,
        attendance: v('dl_att'),
        tonnage: v('dl_ton'),
        mutu_grade: v('dl_mutu'),
        losses_brondolan: v('dl_loss'),
        apd_ok: v('dl_apd'),
        discipline_score: v('dl_dis'),
        note: (document.getElementById('dl_note').value||'').trim()
      });
      if(!r.ok) throw new Error(r.error||'Gagal');
      toast('Log tersimpan','ok');
      overlay.remove();
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
  const v = setViewTitle('Kelulusan', 'Set keputusan LULUS / TIDAK LULUS berdasarkan monitoring');
  const r = await callApi('listGraduation', {});
  if(!r.ok) return v.appendChild(card([h('div',{class:'text-rose-600'}, r.error||'Gagal')]));
  const items = r.items||[];
  v.appendChild(card([
    table(['Peserta','Status','Keputusan','Aksi'], items.map(it=>[
      `${it.name} (${it.nik})`,
      badge(it.status||'-'),
      badge(it.decision||'-'),
      h('button',{class:'rounded-xl px-3 py-2 text-xs bg-emerald-600 text-white', onclick:()=>openGradModal(it)},'Putuskan')
    ]))
  ]));
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
      const r = await callApi('graduateParticipant', { participant_id: it.participant_id, decision, reason });
      if(!r.ok) throw new Error(r.error||'Gagal');
      toast('Keputusan disimpan','ok');
      overlay.remove();
      renderGraduation();
    }catch(e){ toast(e.message,'error'); }
    finally{ btnBusy(btn,false,'Simpan'); }
  };
}

async function renderCertificates(){
  const v = setViewTitle('Sertifikat', 'Terbitkan sertifikat peserta & mentor');
  const r = await callApi('listCertificates', {});
  const isAdmin = (state.user?.role === 'ADMIN');
  const top = h('div',{class:'flex gap-2 mb-4'},[
    h('button',{class:'rounded-2xl px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700 text-sm', onclick:async ()=>{
      const pid = prompt('participant_id untuk terbitkan sertifikat peserta:','');
      if(!pid) return;
      const rr = await callApi('issueCertificate', { person_type:'PESERTA', person_id: pid });
      if(!rr.ok) return toast(rr.error||'Gagal','error');
      toast('Sertifikat peserta diterbitkan','ok');
      renderCertificates();
    }},'Terbitkan Sertifikat Peserta'),
    h('button',{class:'rounded-2xl px-4 py-2 border border-slate-200 dark:border-slate-800 text-sm', onclick:async ()=>{
      const mid = prompt('mentor_id untuk terbitkan sertifikat mentor:','');
      if(!mid) return;
      const rr = await callApi('issueCertificate', { person_type:'MENTOR', person_id: mid });
      if(!rr.ok) return toast(rr.error||'Gagal','error');
      toast('Sertifikat mentor diterbitkan','ok');
      renderCertificates();
    }},'Terbitkan Sertifikat Mentor'),
    h('button',{class:'rounded-2xl px-4 py-2 border border-slate-200 dark:border-slate-800 text-sm', onclick:()=>renderCertificates()},'Refresh'),
  ]);
  v.appendChild(top);

  if(!r.ok) return v.appendChild(card([h('div',{class:'text-rose-600'}, r.error||'Gagal')]));
  const items = r.items||[];
  v.appendChild(card([
    table(['No','Tipe','Nama','Tanggal','Aksi'], items.map(x=>{
      const verifyUrl = `${CONFIG.GAS_URL_EXEC}?action=verifyCert&code=${encodeURIComponent(x.verify_code||x.certificate_no||'')}&format=html`;
      return [
        x.certificate_no||'-',
        badge(x.person_type||'-'),
        `${x.name||'-'} (${x.nik||'-'})`,
        isoToDMY(x.issue_date||'-'),
        h('div',{class:'flex flex-wrap gap-2'},[
          x.pdf_url ? h('a',{href:x.pdf_url, target:'_blank', rel:'noopener', class:'rounded-xl px-3 py-2 text-xs bg-emerald-600 text-white hover:bg-emerald-700'},'PDF') : h('span',{class:'text-xs text-slate-400'},'—'),
          h('a',{href:verifyUrl, target:'_blank', rel:'noopener', class:'rounded-xl px-3 py-2 text-xs border border-slate-200 dark:border-slate-800'},'Verifikasi'),
          isAdmin ? h('button',{class:'rounded-xl px-3 py-2 text-xs bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900', onclick:async ()=>{
            const ok = confirm('Regenerate PDF sertifikat ini? (Template terbaru akan dipakai)');
            if(!ok) return;
            const rr = await callApi('regenerateCertificatePdf', { cert_id: x.cert_id });
            if(!rr.ok) return toast(rr.error||'Gagal','error');
            toast('PDF di-regenerate','ok');
            renderCertificates();
          }},'Re-generate PDF') : null,
        ].filter(Boolean))
      ];
    }))
  ]));
}

async function renderIncentives(){
  const v = setViewTitle('Insentif Mentor', 'Tracking & verifikasi insentif');
  const r = await callApi('listMentorIncentives', {});
  if(!r.ok) return v.appendChild(card([h('div',{class:'text-rose-600'}, r.error||'Gagal')]));
  const items = r.items||[];
  v.appendChild(card([
    table(['Mentor','Mentee','Stage','Amount','Due','Status','Aksi'], items.map(x=>[
      x.mentor_name||'-',
      x.participant_name||'-',
      badge(x.stage||'-'),
      x.amount||'-',
      x.due_date||'-',
      badge(x.status||'-'),
      h('button',{class:'rounded-xl px-3 py-2 text-xs border border-slate-200 dark:border-slate-800', onclick:async ()=>{
        const rr = await callApi('verifyIncentive', { incentive_id: x.incentive_id, status:'VERIFIED' });
        if(!rr.ok) return toast(rr.error||'Gagal','error');
        toast('Terverifikasi','ok');
        renderIncentives();
      }},'Verify')
    ]))
  ]));
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
  const isAdmin = (state.user?.role === 'ADMIN');
  const v = setViewTitle('Pengaturan', isAdmin ? 'Konfigurasi aplikasi, logo, dan user' : 'Ganti PIN Anda');

  const r = await callApi('getSettings', {});
  const settings = (r && r.ok) ? (r.settings || {}) : {};

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
      const rr = await callApi('changeMyPin', { old_pin: (document.getElementById('sp_old').value||'').trim(), new_pin: (document.getElementById('sp_new').value||'').trim() });
      if(!rr.ok) throw new Error(rr.error||'Gagal');
      toast('PIN berhasil diganti','ok');
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
    const rr = await callApi('getSettings', { estate: currentEstateCode });
    if(!rr.ok) return toast(rr.error||'Gagal load settings estate', 'error');
    const s2 = rr.settings || {};
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
      const rr = await callApi('setSettings', { estate: estateCode, items_json: JSON.stringify(items) });
      if(!rr.ok) throw new Error(rr.error||'Gagal');
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
    const rr = await callApi('listMasterEstates', {});
    if(!rr.ok) {
      estatesHolder.innerHTML='';
      estatesHolder.appendChild(h('div',{class:'text-rose-600'}, rr.error||'Gagal'));
      return;
    }
    const items = rr.items || [];
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
    const rr = await callApi('deleteMasterEstate', { estate_code });
    if(!rr.ok) return toast(rr.error||'Gagal','error');
    toast('Master Estate dihapus','ok');
    refreshMasterEstates();
  }

  function openMasterEstateModal(row, onDone){
    const isEdit = !!row;
    const overlay = h('div', { class:'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40' }, []);
    const modal = card([
      h('div',{class:'text-lg font-semibold'}, isEdit ? 'Edit Master Estate' : 'Tambah Master Estate'),
      h('div',{class:'mt-4 grid md:grid-cols-2 gap-3'},[
        mfield('Kode Estate (SRIE, dst)','me_code', row?.estate_code||'', { disabled:isEdit }),
        mfield('Nama Estate','me_name', row?.estate_name||''),
        mfield('Nama Manager','me_manager', row?.manager_name||''),
        mfield('Active (TRUE/FALSE)','me_active', String(row?.active!==false)),
      ]),
      h('div',{class:'mt-5 flex justify-end gap-2'},[
        h('button',{class:'rounded-2xl px-4 py-2 text-sm border border-slate-200 dark:border-slate-800', onclick:()=>overlay.remove()},'Batal'),
        h('button',{id:'btnSaveME', class:'rounded-2xl px-4 py-2 text-sm bg-emerald-600 text-white hover:bg-emerald-700 flex items-center gap-2'},[
          h('span',{'data-spinner':'', class:'hidden w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin'}),
          h('span',{'data-label':'','data-orig':'Simpan'},'Simpan')
        ])
      ])
    ]);
    modal.classList.add('w-full','max-w-3xl');
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

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
        const rr = await callApi('upsertMasterEstate', payload);
        if(!rr.ok) throw new Error(rr.error||'Gagal');
        toast('Master Estate tersimpan','ok');
        overlay.remove();
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
    const rr = await callApi('listUsers', {});
    if(!rr.ok) {
      usersHolder.innerHTML='';
      usersHolder.appendChild(h('div',{class:'text-rose-600'}, rr.error||'Gagal'));
      return;
    }
    const items = rr.items || [];
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
    const rr = await callApi('resetUserPin', { user_id, new_pin: (newPin||'1234').trim() });
    if(!rr.ok) return toast(rr.error||'Gagal','error');
    toast('PIN direset','ok');
  }
  async function deleteUser(user_id){
    if(!user_id) return;
    if(!confirm('Hapus user ini?')) return;
    const rr = await callApi('deleteUser', { user_id });
    if(!rr.ok) return toast(rr.error||'Gagal','error');
    toast('User dihapus','ok');
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
  const overlay = h('div', { class:'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40' }, []);
  const modal = card([
    h('div',{class:'text-lg font-semibold'}, isEdit ? 'Edit User' : 'Tambah User'),
    h('div',{class:'mt-4 grid md:grid-cols-2 gap-3'},[
      ufield('NIK','u_nik', user?.nik||''),
      ufield('Nama','u_name', user?.name||''),
      ufield('Role (ADMIN/ASISTEN/MANDOR/MENTOR)','u_role', user?.role||'MANDOR'),
      ufield('Active (TRUE/FALSE)','u_active', String(user?.active||'TRUE')),
      uEstateSelect('Estate (Kode)','u_estate', user?.estate||''),
      uDivisiField('Divisi (angka)','u_divisi', user?.unit||user?.divisi||''),
      ufield('PIN (kosong = tidak diubah)','u_pin',''),
    ]),
    h('div',{class:'mt-5 flex justify-end gap-2'},[
      h('button',{class:'rounded-2xl px-4 py-2 text-sm border border-slate-200 dark:border-slate-800', onclick:()=>overlay.remove()},'Batal'),
      h('button',{id:'btnSaveUser', class:'rounded-2xl px-4 py-2 text-sm bg-emerald-600 text-white hover:bg-emerald-700 flex items-center gap-2'},[
        h('span',{'data-spinner':'', class:'hidden w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin'}),
        h('span',{'data-label':'','data-orig':'Simpan'},'Simpan')
      ])
    ])
  ]);
  modal.classList.add('w-full','max-w-3xl');
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
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
      const rr = await callApi('upsertUser', payload);
      if(!rr.ok) throw new Error(rr.error||'Gagal');
      toast('User tersimpan','ok');
      overlay.remove();
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

boot();
