(function (global) {
  'use strict';

  const App = global.AbsensiApp = global.AbsensiApp || {};

  App.uid = function uid() {
    return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  };

  App.escapeHtml = function escapeHtml(text) {
    return String(text ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  App.sanitizeSheetName = function sanitizeSheetName(name, usedNames) {
    let base = String(name || 'Sheet')
      .replace(/[\\/?*\[\]:]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!base) base = 'Sheet';
    base = base.slice(0, 31);
    let finalName = base;
    let i = 2;
    while (usedNames.has(finalName.toLowerCase())) {
      const suffix = ` ${i}`;
      finalName = `${base.slice(0, 31 - suffix.length)}${suffix}`;
      i += 1;
    }
    usedNames.add(finalName.toLowerCase());
    return finalName;
  };

  App.readFileAsText = function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error || new Error(`Gagal membaca ${file.name}`));
      reader.readAsText(file, 'utf-8');
    });
  };

  App.pad2 = function pad2(n) {
    return String(n).padStart(2, '0');
  };

  App.formatISODate = function formatISODate(date) {
    return `${date.getFullYear()}-${App.pad2(date.getMonth() + 1)}-${App.pad2(date.getDate())}`;
  };

  App.monthKeyFromDate = function monthKeyFromDate(date) {
    return `${date.getFullYear()}-${App.pad2(date.getMonth() + 1)}`;
  };

  App.prettyDate = function prettyDate(isoMonth) {
    const [y, m] = String(isoMonth).split('-').map(Number);
    const dt = new Date(y, (m || 1) - 1, 1);
    return dt.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  };

  App.hexFill = function hexFill(color) {
    return { type: 'pattern', pattern: 'solid', fgColor: { argb: String(color).replace('#', '') } };
  };

  App.makeBorder = function makeBorder(color = '1E293B') {
    return {
      top: { style: 'thin', color: { argb: color } },
      left: { style: 'thin', color: { argb: color } },
      bottom: { style: 'thin', color: { argb: color } },
      right: { style: 'thin', color: { argb: color } }
    };
  };

  App.styleCell = function styleCell(cell, opts = {}) {
    if (opts.font) cell.font = opts.font;
    if (opts.alignment) cell.alignment = opts.alignment;
    if (opts.fill) cell.fill = opts.fill;
    if (opts.border) cell.border = opts.border;
    if (opts.numFmt) cell.numFmt = opts.numFmt;
  };
})(window);
