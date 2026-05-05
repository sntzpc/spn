(function (global) {
  'use strict';

  const App = global.AbsensiApp = global.AbsensiApp || {};

  App.CONFIG = {
    DB_NAME: 'absensi-konverter-db',
    DB_VERSION: 1,
    STORE_FILES: 'files',
    THEME_KEY: 'absensi-konverter-theme',
    THEMES: { LIGHT: 'light', DARK: 'dark' }
  };

  App.state = {
    db: null,
    files: []
  };

  App.dom = {
    fileInput: document.getElementById('fileInput'),
    fileList: document.getElementById('fileList'),
    previewPanel: document.getElementById('previewPanel'),
    btnExport: document.getElementById('btnExport'),
    btnClearDb: document.getElementById('btnClearDb'),
    summaryBadge: document.getElementById('summaryBadge'),
    outputName: document.getElementById('outputName'),
    dbStatus: document.getElementById('dbStatus'),
    themeToggle: document.getElementById('themeToggle'),
    themeToggleLabel: document.getElementById('themeToggleLabel'),
    themeToggleIcon: document.getElementById('themeToggleIcon')
  };
})(window);
