import { CONFIG } from './config.js';

function qs(obj) {
  const p = new URLSearchParams();
  Object.entries(obj || {}).forEach(([k,v]) => {
    if (v === undefined || v === null) return;
    p.set(k, String(v));
  });
  return p.toString();
}

function jsonp(url, params, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const cb = 'cb_' + Math.random().toString(36).slice(2);
    const script = document.createElement('script');
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('JSONP timeout'));
    }, timeoutMs);

    function cleanup() {
      clearTimeout(timer);
      delete window[cb];
      script.remove();
    }

    window[cb] = (data) => {
      cleanup();
      resolve(data);
    };

    const full = url + (url.includes('?') ? '&' : '?') + qs({ ...params, callback: cb });
    script.src = full;
    script.onerror = () => {
      cleanup();
      reject(new Error('JSONP network error'));
    };
    document.head.appendChild(script);
  });
}

async function httpJson(url, params) {
  const full = url + (url.includes('?') ? '&' : '?') + qs(params);
  const res = await fetch(full, { method: 'GET', credentials: 'omit' });
  const ct = res.headers.get('content-type') || '';
  if (!res.ok) throw new Error('HTTP ' + res.status);
  if (ct.includes('application/json') || ct.includes('text/json')) {
    return await res.json();
  }
  // GAS kadang text/plain
  const txt = await res.text();
  try { return JSON.parse(txt); } catch { return { ok:false, error:'Invalid JSON', raw:txt }; }
}

export async function callApi(action, payload = {}) {
  if (!action) throw new Error('Missing action (client)');
  const token = localStorage.getItem(CONFIG.TOKEN_KEY) || '';
  const params = { action, token, ...payload };

  // Prefer googleusercontent if configured
  const primary = CONFIG.GAS_URL_GUC?.trim() ? CONFIG.GAS_URL_GUC.trim() : CONFIG.GAS_URL_EXEC.trim();
  if (!primary || primary.includes('PASTE_YOUR_GAS_EXEC_URL_HERE')) {
    throw new Error('CONFIG GAS_URL_EXEC belum diisi.');
  }

  // Coba fetch dulu
  try {
    return await httpJson(primary, params);
  } catch (e1) {
    // fallback JSONP
    try {
      return await jsonp(primary, params);
    } catch (e2) {
      // fallback ke exec jika primary guc
      if (primary !== CONFIG.GAS_URL_EXEC.trim()) {
        try { return await httpJson(CONFIG.GAS_URL_EXEC.trim(), params); } catch {}
        return await jsonp(CONFIG.GAS_URL_EXEC.trim(), params);
      }
      throw e2;
    }
  }
}

// POST helper (for file upload etc.)
export function callApiPost(action, payload = {}) {
  if (!action) throw new Error('Missing action (client)');
  const token = localStorage.getItem(CONFIG.TOKEN_KEY) || '';
  // Prefer googleusercontent if configured (sering lebih stabil di Chrome mobile)
  const primary = (CONFIG.GAS_URL_GUC || '').trim() ? (CONFIG.GAS_URL_GUC || '').trim() : (CONFIG.GAS_URL_EXEC || '').trim();
  const fallback = (CONFIG.GAS_URL_EXEC || '').trim();
  if (!primary || primary.includes('PASTE_YOUR_GAS_EXEC_URL_HERE')) {
    throw new Error('CONFIG GAS_URL_EXEC belum diisi.');
  }

  // ✅ Hindari X-Frame-Options SAMEORIGIN (iframe ditolak) dan hindari preflight OPTIONS.
  // Trik: kirim body JSON dengan Content-Type text/plain supaya tidak memicu preflight.
  const postOnce = async (url) => {
    const controller = new AbortController();
    const to = setTimeout(() => controller.abort(), 45000);
    try {
      const res = await fetch(url, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(Object.assign({ action, token }, payload || {})),
        signal: controller.signal,
      });
      const txt = await res.text();
      try { return JSON.parse(txt); }
      catch { return { ok:false, error:'Respon tidak valid', raw: txt }; }
    } finally {
      clearTimeout(to);
    }
  };

  return (async ()=>{
    try {
      return await postOnce(primary);
    } catch (e1) {
      if (fallback && fallback !== primary) {
        try { return await postOnce(fallback); } catch (e2) {}
      }
      return { ok:false, error: (e1 && e1.message) ? e1.message : String(e1) };
    }
  })();
}
