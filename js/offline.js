// Offline-first storage (IndexedDB) + Outbox queue
// Stores: programs, master_estates, users, settings, candidates, selection, participants,
// mentors, pairings, daily_logs, weekly_recaps, monthly_recaps, final_recaps, graduations, certificates, incentives

const DB_NAME = 'spn_offline_v1';
const DB_VER = 3;

const STORES = [
  'programs',
  'master_estates',
  'users',
  'settings',
  'candidates',
  'selection',
  'participants',
  'mentors',
  'pairings',
  'daily_logs',
  'weekly_recaps',
  'monthly_recaps',
  'final_recaps',
  'graduations',
  'certificates',
  'incentives',
  'meta',
  'outbox',
];

let _dbp = null;

function openDb_() {
  if (_dbp) return _dbp;
  _dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const name of STORES) {
        if (!db.objectStoreNames.contains(name)) {
          const keyPath = (name === 'outbox') ? 'id' : 'id';
          db.createObjectStore(name, { keyPath });
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return _dbp;
}

function tx_(db, store, mode = 'readonly') {
  return db.transaction(store, mode).objectStore(store);
}

function nowMs_() { return Date.now(); }

function makeId_() {
  try {
    if (crypto?.randomUUID) return crypto.randomUUID();
  } catch {}
  return 'loc_' + Date.now() + '_' + Math.random().toString(36).slice(2);
}

export async function offlineInit() {
  await openDb_();
}

// -----------------
// Cache helpers
// -----------------
export async function cacheReplace(store, rows, meta = {}) {
  const db = await openDb_();
  await new Promise((resolve, reject) => {
    const tx = db.transaction([store, 'meta'], 'readwrite');
    const os = tx.objectStore(store);
    const ms = tx.objectStore('meta');
    // clear then bulk put
    const clr = os.clear();
    clr.onerror = () => reject(clr.error);
    clr.onsuccess = () => {
      (rows || []).forEach(r => os.put(Object.assign({ ts: nowMs_() }, r)));
      ms.put({ id: store, ts: nowMs_(), meta: meta || {} });
    };
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

export async function cacheUpsert(store, row, meta = null) {
  const db = await openDb_();
  await new Promise((resolve, reject) => {
    const tx = db.transaction([store, 'meta'], 'readwrite');
    tx.objectStore(store).put(Object.assign({ ts: nowMs_() }, row));
    if (meta) tx.objectStore('meta').put({ id: store, ts: nowMs_(), meta });
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

export async function cacheDelete(store, id) {
  const db = await openDb_();
  await new Promise((resolve, reject) => {
    const t = db.transaction(store, 'readwrite');
    const req = t.objectStore(store).delete(String(id));
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}


export async function cacheGetAllRaw(store) {
  const db = await openDb_();
  const rows = await new Promise((resolve, reject) => {
    const req = tx_(db, store, 'readonly').getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
  return rows || [];
}

export async function cacheGetAll(store, filter = {}) {
  const db = await openDb_();
  const rows = await new Promise((resolve, reject) => {
    const req = tx_(db, store, 'readonly').getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });

  // filter by meta fields if present (program_id/estate/etc.)
  const f = filter || {};
  const out = rows
    .map(r => r && r.data ? r.data : r)
    .filter(x => {
      if (!x) return false;
      if (f.program_id && String(x.program_id || '') !== String(f.program_id)) return false;
      if (f.estate && String(x.estate_code || x.estate || '').toUpperCase() !== String(f.estate).toUpperCase()) return false;
      return true;
    });
  return out;
}

export async function cacheMeta(store) {
  const db = await openDb_();
  const it = await new Promise((resolve, reject) => {
    const req = tx_(db, 'meta', 'readonly').get(store);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
  return it;
}

// -----------------
// Outbox helpers
// -----------------
export async function outboxList() {
  const db = await openDb_();
  const rows = await new Promise((resolve, reject) => {
    const req = tx_(db, 'outbox', 'readonly').getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
  // order by ts asc
  return rows.sort((a,b)=>(a.ts||0)-(b.ts||0));
}

export async function outboxAdd(action, payload) {
  const db = await openDb_();
  const id = makeId_();
  const item = { id, ts: nowMs_(), action: String(action||''), payload: payload || {} };
  await new Promise((resolve, reject) => {
    const req = tx_(db, 'outbox', 'readwrite').put(item);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
  return item;
}

export async function outboxRemove(id) {
  const db = await openDb_();
  await new Promise((resolve, reject) => {
    const req = tx_(db, 'outbox', 'readwrite').delete(String(id));
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

// Try call; if fails, queue & return ok:true with queued flag.
export async function callOrQueue(fn, action, payload, label = '') {
  try {
    const r = await fn();
    // If server returns explicit error, do not auto-queue
    if (r && r.ok === false) return r;
    return r;
  } catch (e) {
    await outboxAdd(action, payload);
    return { ok: true, queued: true, label, error: (e && e.message) ? e.message : String(e) };
  }
}
