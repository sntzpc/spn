export function toast(msg, type='info') {
  const host = document.getElementById('toastHost');
  const el = document.createElement('div');
  const base = 'px-4 py-3 rounded-2xl shadow-lg text-sm border backdrop-blur';
  const cls = type==='error'
    ? 'bg-rose-50 text-rose-900 border-rose-200 dark:bg-rose-950/60 dark:text-rose-100 dark:border-rose-900'
    : type==='ok'
      ? 'bg-emerald-50 text-emerald-900 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-100 dark:border-emerald-900'
      : 'bg-slate-50 text-slate-900 border-slate-200 dark:bg-slate-900/60 dark:text-slate-100 dark:border-slate-700';
  el.className = base + ' ' + cls;
  el.textContent = msg;
  host.appendChild(el);
  setTimeout(()=>{ el.classList.add('opacity-0'); el.style.transition='opacity .4s'; }, 2500);
  setTimeout(()=>{ el.remove(); }, 3000);
}

export function btnBusy(btn, busy=true, labelBusy='Memproses...') {
  if (!btn) return;
  btn.disabled = !!busy;
  const sp = btn.querySelector('[data-spinner]');
  const lb = btn.querySelector('[data-label]');
  if (sp) sp.classList.toggle('hidden', !busy);
  if (lb && labelBusy) lb.textContent = busy ? labelBusy : (lb.dataset.orig || lb.textContent);
}

export function h(tag, attrs={}, children=[]) {
  const el = document.createElement(tag);
  Object.entries(attrs||{}).forEach(([k,v])=>{
    if (k==='class') el.className = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v !== undefined && v !== null) el.setAttribute(k, String(v));
  });
  (Array.isArray(children)?children:[children]).forEach(ch=>{
    if (ch === null || ch === undefined) return;
    if (typeof ch === 'string') el.appendChild(document.createTextNode(ch));
    else el.appendChild(ch);
  });
  return el;
}

export function formatDateISO(d) {
  const dt = (d instanceof Date) ? d : new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth()+1).padStart(2,'0');
  const da = String(dt.getDate()).padStart(2,'0');
  return `${y}-${m}-${da}`;
}

export function formatDateLongID(d, timeZone='Asia/Jakarta') {
  if (!d) return '';
  const dt = (d instanceof Date) ? d : new Date(d);
  if (isNaN(dt.getTime())) return String(d);
  try {
    return new Intl.DateTimeFormat('id-ID', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      timeZone
    }).format(dt);
  } catch (e) {
    // fallback jika Intl/timeZone tidak tersedia
    return dt.toLocaleDateString('id-ID', { weekday:'long', day:'2-digit', month:'long', year:'numeric' });
  }
}

// Format tanggal dd-mm-yyyy dengan timezone (default WIB)
export function formatDateDMYID(d, timeZone='Asia/Jakarta') {
  // Format dd-mm-yyyy (WIB default)
  if (!d) return '';
  const dt = (d instanceof Date) ? d : new Date(d);
  if (isNaN(dt.getTime())) return String(d);
  try {
    const parts = new Intl.DateTimeFormat('id-ID', {
      day: '2-digit', month: '2-digit', year: 'numeric', timeZone
    }).formatToParts(dt);
    const dd = (parts.find(p => p.type === 'day') || {}).value || '';
    const mm = (parts.find(p => p.type === 'month') || {}).value || '';
    const yy = (parts.find(p => p.type === 'year') || {}).value || '';
    return `${dd}-${mm}-${yy}`;
  } catch (e) {
    const dd = String(dt.getDate()).padStart(2, '0');
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const yy = String(dt.getFullYear()).padStart(4, '0');
    return `${dd}-${mm}-${yy}`;
  }
}

// dd-mm-yyyy (WIB/local)
export function isoToDMY(iso) {
  const s = String(iso||'').trim();
  if (!s) return '';
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return s;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

export function dmyToISO(dmy) {
  const s = String(dmy||'').trim();
  if (!s) return '';
  const m = s.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!m) return '';
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yy = Number(m[3]);
  if (!(yy>=1900 && yy<=2100)) return '';
  if (!(mm>=1 && mm<=12)) return '';
  if (!(dd>=1 && dd<=31)) return '';
  return `${String(yy).padStart(4,'0')}-${String(mm).padStart(2,'0')}-${String(dd).padStart(2,'0')}`;
}

export function todayDMY() {
  return isoToDMY(formatDateISO(new Date()));
}
