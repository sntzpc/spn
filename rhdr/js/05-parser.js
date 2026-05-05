(function (global) {
  'use strict';

  const App = global.AbsensiApp = global.AbsensiApp || {};

  App.parseMeta = function parseMeta(lines) {
    const meta = { perkebunan: '', region: '', pt: '', unit: '', periode: '' };
    for (const line of lines.slice(0, 20)) {
      const clean = line.replace(/\t/g, ' ').replace(/\s+/g, ' ').trim();
      if (!clean) continue;
      if (clean.startsWith('Perkebunan')) meta.perkebunan = clean.replace(/^Perkebunan\s*/, '').trim();
      else if (clean.startsWith('Region')) meta.region = clean.replace(/^Region\s*/, '').trim();
      else if (/^PT\s/.test(clean)) meta.pt = clean.replace(/^PT\s*/, '').trim();
      else if (clean.startsWith('Unit')) meta.unit = clean.replace(/^Unit\s*/, '').trim();
      else if (clean.startsWith('Periode')) meta.periode = clean.replace(/^Periode\s*/, '').trim();
    }
    return meta;
  };

  App.parseDate = function parseDate(dateStr) {
    const m = String(dateStr).match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (!m) return null;
    const [, dd, mm, yyyy] = m;
    return new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  };

  App.parsePeriodRange = function parsePeriodRange(periodText) {
    const m = String(periodText).match(/(\d{2})\/(\d{2})\/(\d{4})\s+s\/d\s+(\d{2})\/(\d{2})\/(\d{4})/i);
    if (!m) return null;
    const [, d1, m1, y1, d2, m2, y2] = m;
    return {
      start: new Date(Number(y1), Number(m1) - 1, Number(d1)),
      end: new Date(Number(y2), Number(m2) - 1, Number(d2))
    };
  };

  App.parseReport = function parseReport(text, filename) {
    const normalized = String(text || '').replace(/\r/g, '');
    const lines = normalized.split('\n');
    const meta = App.parseMeta(lines);
    const rowRegex = /^\s*(\d{2})\s+([A-Za-z0-9]+)\s+(.+?)\s+(\d{2}\.\d{2}\.\d{4})\s+([A-Z])\s+([0-9.,]+)\s*$/;
    const records = [];

    for (const line of lines) {
      const match = line.match(rowRegex);
      if (!match) continue;
      const [, divisi, nik, nama, tanggal, tipe, hk] = match;
      const dateObj = App.parseDate(tanggal);
      if (!dateObj) continue;
      records.push({
        divisi: divisi.trim(),
        nik: nik.trim(),
        nama: nama.trim(),
        tanggal,
        tanggalISO: App.formatISODate(dateObj),
        day: dateObj.getDate(),
        monthKey: App.monthKeyFromDate(dateObj),
        tipe: tipe.trim().toUpperCase(),
        hk: Number(String(hk).replace('.', '').replace(',', '.')) || 0
      });
    }

    if (!records.length) {
      throw new Error(`Format file ${filename} tidak terbaca. Pastikan file berisi report absensi teks seperti contoh.`);
    }

    const monthSet = [...new Set(records.map(r => r.monthKey))].sort();
    const monthKey = monthSet[0];
    const period = App.parsePeriodRange(meta.periode);
    const workersMap = new Map();
    const typeSet = new Set();

    for (const record of records) {
      if (!workersMap.has(record.nik)) {
        workersMap.set(record.nik, { divisi: record.divisi, nik: record.nik, nama: record.nama, dates: {} });
      }
      const worker = workersMap.get(record.nik);
      worker.dates[record.day] = record.tipe;
      typeSet.add(record.tipe);
    }

    const workers = [...workersMap.values()].sort((a, b) => {
      const d = a.divisi.localeCompare(b.divisi, 'id');
      if (d !== 0) return d;
      return a.nama.localeCompare(b.nama, 'id');
    });

    const maxDay = period && period.start && period.end && App.monthKeyFromDate(period.start) === App.monthKeyFromDate(period.end)
      ? period.end.getDate()
      : Math.max(...records.map(r => r.day));
    const dayColumns = Array.from({ length: maxDay }, (_, i) => i + 1);

    const summaryByType = {};
    for (const t of typeSet) summaryByType[t] = records.filter(r => r.tipe === t).length;

    return {
      meta,
      filename,
      monthKey,
      workers,
      records,
      dayColumns,
      summary: {
        totalRecords: records.length,
        totalWorkers: workers.length,
        totalDivisi: new Set(records.map(r => r.divisi)).size,
        types: summaryByType
      }
    };
  };
})(window);
