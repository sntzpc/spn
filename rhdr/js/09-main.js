(function (global) {
  'use strict';

  const App = global.AbsensiApp = global.AbsensiApp || {};

  App.handleFiles = async function handleFiles(files) {
    if (!files || !files.length) return;
    for (const file of files) {
      const text = await App.readFileAsText(file);
      const parsed = App.parseReport(text, file.name);
      await App.idbPut({
        id: App.uid(),
        filename: file.name,
        rawText: text,
        savedAt: Date.now(),
        ...parsed
      });
    }
    await App.refreshFromDb();
  };

  App.bindEvents = function bindEvents() {
    App.dom.fileList.addEventListener('click', async (event) => {
      const btn = event.target.closest('button[data-action="remove"]');
      if (!btn) return;
      const { id } = btn.dataset;
      if (!id) return;
      await App.idbDelete(id);
      await App.refreshFromDb();
    });

    App.dom.fileInput.addEventListener('change', async (event) => {
      const files = [...(event.target.files || [])];
      if (!files.length) return;
      try {
        await App.handleFiles(files);
      } catch (error) {
        console.error(error);
        alert(error.message || 'Ada file yang gagal diproses.');
      } finally {
        App.dom.fileInput.value = '';
      }
    });

    App.dom.btnExport.addEventListener('click', App.exportWorkbook);
    App.dom.themeToggle.addEventListener('click', App.toggleTheme);

    App.dom.btnClearDb.addEventListener('click', async () => {
      const ok = confirm('Yakin ingin menghapus semua data lokal di IndexedDB?');
      if (!ok) return;
      await App.idbClear();
      await App.refreshFromDb();
    });
  };

  App.boot = async function boot() {
    App.applyTheme(App.getSavedTheme(), false);
    App.bindEvents();
    try {
      App.state.db = await App.openDb();
      await App.refreshFromDb();
    } catch (error) {
      console.error(error);
      App.dom.dbStatus.textContent = 'IndexedDB gagal dibuka.';
      alert('Aplikasi tidak bisa membuka IndexedDB. Silakan coba di browser modern seperti Chrome/Edge/Firefox terbaru.');
    }
  };

  App.boot();
})(window);
