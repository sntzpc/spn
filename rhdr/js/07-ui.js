(function (global) {
  'use strict';

  const App = global.AbsensiApp = global.AbsensiApp || {};

  App.typeBadgeClass = function typeBadgeClass(type) {
    const isDark = App.currentTheme() === App.CONFIG.THEMES.DARK;
    const darkMap = {
      M: 'bg-red-500/20 text-red-200 border-red-400/30',
      K: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/30',
      O: 'bg-amber-500/20 text-amber-200 border-amber-400/30',
      C: 'bg-sky-500/20 text-sky-200 border-sky-400/30',
      S: 'bg-violet-500/20 text-violet-200 border-violet-400/30'
    };
    const lightMap = {
      M: 'bg-rose-50 text-rose-700 border-rose-200',
      K: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      O: 'bg-amber-50 text-amber-700 border-amber-200',
      C: 'bg-sky-50 text-sky-700 border-sky-200',
      S: 'bg-violet-50 text-violet-700 border-violet-200'
    };
    const map = isDark ? darkMap : lightMap;
    return map[type] || (isDark ? 'bg-slate-500/20 text-slate-200 border-slate-400/30' : 'bg-slate-100 text-slate-700 border-slate-300');
  };

  App.renderFileList = function renderFileList() {
    const { fileList, summaryBadge } = App.dom;
    summaryBadge.textContent = `${App.state.files.length} file`;
    fileList.innerHTML = App.state.files.length ? '' : `
      <div class="theme-empty rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-6 text-center text-sm text-slate-400">
        Belum ada file yang diupload.
      </div>`;

    App.state.files.forEach(item => {
      const el = document.createElement('div');
      el.className = 'theme-card rounded-2xl border border-slate-800 bg-slate-950/70 p-4';
      el.innerHTML = `
        <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div class="min-w-0">
            <div class="truncate text-sm font-bold text-white theme-title">${App.escapeHtml(item.filename)}</div>
            <div class="mt-1 text-xs text-slate-400 theme-muted">${App.escapeHtml(item.meta.unit || '-')} • ${App.escapeHtml(item.meta.periode || '-')}</div>
            <div class="mt-3 flex flex-wrap gap-2 text-xs">
              <span class="theme-card-soft rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-slate-200">Pekerja: ${item.summary.totalWorkers}</span>
              <span class="theme-card-soft rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-slate-200">Record: ${item.summary.totalRecords}</span>
              <span class="theme-card-soft rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-slate-200">Bulan: ${App.escapeHtml(App.prettyDate(item.monthKey))}</span>
            </div>
          </div>
          <div class="flex gap-2">
            <button data-action="remove" data-id="${item.id}" class="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-200 hover:bg-rose-500/20">Hapus</button>
          </div>
        </div>`;
      fileList.appendChild(el);
    });
  };

  App.renderPreview = function renderPreview() {
    const { previewPanel } = App.dom;
    previewPanel.innerHTML = App.state.files.length ? '' : `
      <div class="theme-empty rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-8 text-center text-sm text-slate-400">
        Preview akan muncul setelah file diupload.
      </div>`;

    App.state.files.forEach(item => {
      const legend = Object.entries(item.summary.types)
        .map(([type, count]) => `<span class="rounded-full border px-3 py-1 ${App.typeBadgeClass(type)}">${App.escapeHtml(type)}: ${count}</span>`)
        .join('');

      const previewDays = Math.min(15, item.dayColumns.length);
      const sampleWorkers = item.workers.slice(0, 6).map(worker => {
        const score = App.calculateWorkerScores(worker, item.dayColumns);
        const cells = item.dayColumns.slice(0, previewDays).map(day => {
          const val = worker.dates[day] || '';
          const cls = val ? App.typeBadgeClass(val) : (App.currentTheme() === App.CONFIG.THEMES.DARK ? 'border-slate-800 bg-slate-950 text-slate-600' : 'border-slate-300 bg-white text-slate-400');
          return `<div class="flex h-8 w-8 items-center justify-center rounded-lg border text-[11px] font-bold ${cls}" title="Nilai: ${App.escapeHtml(App.formatScore(score.scoresByDay[day]))}">${App.escapeHtml(val || '')}</div>`;
        }).join('');
        return `
          <div class="theme-card overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/70">
            <div class="border-b border-slate-800 px-4 py-3">
              <div class="text-sm font-bold text-white theme-title">${App.escapeHtml(worker.nama)}</div>
              <div class="text-xs text-slate-400 theme-muted">Divisi ${App.escapeHtml(worker.divisi)} • NIK ${App.escapeHtml(worker.nik)} • Nilai rata-rata ${App.formatScore(score.average)}</div>
            </div>
            <div class="p-4">
              <div class="mb-2 grid gap-1 text-center text-[10px] font-semibold text-slate-500" style="grid-template-columns: repeat(${previewDays}, minmax(0, 1fr));">
                ${item.dayColumns.slice(0, previewDays).map(day => `<div>${day}</div>`).join('')}
              </div>
              <div class="grid gap-1" style="grid-template-columns: repeat(${previewDays}, minmax(0, 1fr));">${cells}</div>
            </div>
          </div>`;
      }).join('');

      const wrap = document.createElement('div');
      wrap.className = 'theme-card rounded-3xl border border-slate-800 bg-slate-950/70 p-4';
      wrap.innerHTML = `
        <div class="mb-4 flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div class="text-base font-bold text-white theme-title">${App.escapeHtml(item.filename)}</div>
            <div class="mt-1 text-xs text-slate-400 theme-muted">${App.escapeHtml(item.meta.perkebunan || '-')} • ${App.escapeHtml(item.meta.region || '-')}</div>
            <div class="text-xs text-slate-400 theme-muted">${App.escapeHtml(item.meta.pt || '-')} • ${App.escapeHtml(item.meta.unit || '-')}</div>
          </div>
          <div class="flex flex-wrap gap-2 text-xs">${legend}</div>
        </div>
        <div class="mb-4 grid gap-3 sm:grid-cols-3">
          <div class="theme-card-soft rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3"><div class="text-xs text-slate-400 theme-muted">Sheet</div><div class="mt-1 font-bold text-white theme-title">${App.escapeHtml(item.sheetName || item.filename)}</div></div>
          <div class="theme-card-soft rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3"><div class="text-xs text-slate-400 theme-muted">Periode</div><div class="mt-1 font-bold text-white theme-title">${App.escapeHtml(item.meta.periode || '-')}</div></div>
          <div class="theme-card-soft rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3"><div class="text-xs text-slate-400 theme-muted">Pekerja / Record</div><div class="mt-1 font-bold text-white theme-title">${item.summary.totalWorkers} / ${item.summary.totalRecords}</div></div>
        </div>
        <div class="mb-3 rounded-2xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-3 text-xs font-semibold text-cyan-200">
          Export Excel sekarang otomatis menambahkan sheet nilai. Aturan: K=5, M=0, O=5, C=0 tidak menjadi pembagi, S bertingkat 4/3/2/1.
        </div>
        <div class="space-y-3">${sampleWorkers || '<div class="text-sm text-slate-400">Tidak ada sample.</div>'}</div>`;
      previewPanel.appendChild(wrap);
    });
  };

  App.updateDbStatus = function updateDbStatus() {
    const total = App.state.files.length;
    App.dom.dbStatus.textContent = total ? `${total} file tersimpan di IndexedDB.` : 'Belum ada data lokal tersimpan.';
    App.dom.btnExport.disabled = total === 0;
  };

  App.refreshFromDb = async function refreshFromDb() {
    const all = await App.idbGetAll();
    all.sort((a, b) => (a.savedAt || 0) - (b.savedAt || 0));
    const usedNames = new Set();
    App.state.files = all.map(item => ({ ...item, sheetName: App.sanitizeSheetName(item.filename.replace(/\.[^.]+$/, ''), usedNames) }));
    App.renderFileList();
    App.renderPreview();
    App.updateDbStatus();
  };
})(window);
