(function (global) {
  'use strict';

  const App = global.AbsensiApp = global.AbsensiApp || {};

  App.getTypeStyle = function getTypeStyle(type) {
    const upper = String(type || '').toUpperCase();
    const map = {
      M: { fill: App.hexFill('FF0000'), fontColor: 'FFFFFFFF' },
      K: { fill: App.hexFill('111827'), fontColor: 'FFFFFFFF' },
      O: { fill: App.hexFill('16A34A'), fontColor: 'FFFFFFFF' },
      C: { fill: App.hexFill('0EA5E9'), fontColor: 'FFFFFFFF' },
      S: { fill: App.hexFill('7C3AED'), fontColor: 'FFFFFFFF' }
    };
    return map[upper] || { fill: App.hexFill('334155'), fontColor: 'FFFFFFFF' };
  };

  function makeSheetPlan(files) {
    const usedNames = new Set(['ringkasan']);
    return files.map(item => {
      const base = item.filename.replace(/\.[^.]+$/, '');
      return {
        item,
        attendanceSheetName: App.sanitizeSheetName(base, usedNames),
        scoreSheetName: App.sanitizeSheetName(`Nilai ${base}`, usedNames)
      };
    });
  }

  function writeSummarySheet(workbook, sheetPlan) {
    const ws = workbook.addWorksheet('Ringkasan');
    ws.views = [{ state: 'frozen', ySplit: 5 }];
    ws.properties.defaultRowHeight = 20;
    ws.columns = [
      { width: 6 }, { width: 28 }, { width: 22 }, { width: 22 }, { width: 24 },
      { width: 24 }, { width: 20 }, { width: 14 }, { width: 14 }, { width: 20 }
    ];

    ws.mergeCells('A1:J1');
    ws.getCell('A1').value = 'RINGKASAN ABSENSI DAN NILAI PEMANEN BARU';
    App.styleCell(ws.getCell('A1'), {
      font: { bold: true, size: 16, color: { argb: 'FFFFFFFF' } },
      alignment: { horizontal: 'center', vertical: 'middle' },
      fill: App.hexFill('0F172A')
    });
    ws.getRow(1).height = 26;

    ws.mergeCells('A2:J2');
    ws.getCell('A2').value = `Dibuat: ${new Date().toLocaleString('id-ID')}`;
    App.styleCell(ws.getCell('A2'), {
      font: { italic: true, color: { argb: 'CBD5E1' } },
      alignment: { horizontal: 'center' },
      fill: App.hexFill('111827')
    });

    const headerRowNo = 4;
    const headers = ['No', 'Nama File', 'Sheet Absensi', 'Sheet Nilai', 'Unit', 'Periode', 'Bulan', 'Pekerja', 'Record', 'Tipe Absensi'];
    headers.forEach((header, idx) => {
      const cell = ws.getRow(headerRowNo).getCell(idx + 1);
      cell.value = header;
      App.styleCell(cell, {
        font: { bold: true, color: { argb: 'FFFFFFFF' } },
        alignment: { horizontal: 'center', vertical: 'middle' },
        fill: App.hexFill('1E293B'),
        border: App.makeBorder('334155')
      });
    });

    sheetPlan.forEach((plan, index) => {
      const item = plan.item;
      const row = ws.getRow(headerRowNo + 1 + index);
      const typeLabel = Object.entries(item.summary.types).map(([k, v]) => `${k}:${v}`).join(', ');
      const values = [
        index + 1,
        item.filename,
        plan.attendanceSheetName,
        plan.scoreSheetName,
        item.meta.unit || '-',
        item.meta.periode || '-',
        App.prettyDate(item.monthKey),
        item.summary.totalWorkers,
        item.summary.totalRecords,
        typeLabel
      ];
      values.forEach((value, i) => {
        const cell = row.getCell(i + 1);
        cell.value = value;
        App.styleCell(cell, {
          font: { color: { argb: 'E2E8F0' } },
          alignment: { vertical: 'middle', horizontal: i === 0 ? 'center' : 'left', wrapText: true },
          fill: App.hexFill(index % 2 === 0 ? '0F172A' : '111827'),
          border: App.makeBorder('1F2937')
        });
      });
    });

    const ruleStart = headerRowNo + sheetPlan.length + 3;
    ws.mergeCells(ruleStart, 1, ruleStart, 10);
    ws.getCell(ruleStart, 1).value = 'Aturan nilai: K=5; M=0; O=5; C=0 namun tidak dihitung sebagai pembagi; S pertama=4, S kedua=3, S ketiga=2, S keempat dan seterusnya=1. Rata-rata dihitung dari kode yang menjadi pembagi saja.';
    App.styleCell(ws.getCell(ruleStart, 1), {
      font: { bold: true, color: { argb: 'FDE68A' } },
      alignment: { wrapText: true, vertical: 'middle' },
      fill: App.hexFill('78350F'),
      border: App.makeBorder('92400E')
    });
  }

  function writeAttendanceSheet(workbook, plan) {
    const item = plan.item;
    const ws = workbook.addWorksheet(plan.attendanceSheetName);
    ws.views = [{ state: 'frozen', xSplit: 3, ySplit: 8 }];
    ws.properties.defaultRowHeight = 22;
    ws.columns = [{ width: 8 }, { width: 18 }, { width: 28 }, ...item.dayColumns.map(() => ({ width: 5 }))];

    ws.mergeCells(1, 1, 1, 3 + item.dayColumns.length);
    ws.getCell(1, 1).value = `ABSENSI PEMANEN BARU - ${item.meta.unit || item.filename}`;
    App.styleCell(ws.getCell(1, 1), {
      font: { bold: true, size: 16, color: { argb: 'FFFFFFFF' } },
      alignment: { horizontal: 'center', vertical: 'middle' },
      fill: App.hexFill('020617')
    });
    ws.getRow(1).height = 26;

    const metaRows = [
      ['Perkebunan', item.meta.perkebunan || '-'],
      ['Region', item.meta.region || '-'],
      ['PT', item.meta.pt || '-'],
      ['Unit', item.meta.unit || '-'],
      ['Periode', item.meta.periode || '-'],
      ['Bulan', App.prettyDate(item.monthKey)]
    ];

    metaRows.forEach((meta, i) => {
      const rowNo = 2 + i;
      ws.getCell(rowNo, 1).value = meta[0];
      ws.getCell(rowNo, 2).value = meta[1];
      ws.mergeCells(rowNo, 2, rowNo, 3 + item.dayColumns.length);
      App.styleCell(ws.getCell(rowNo, 1), {
        font: { bold: true, color: { argb: '93C5FD' } },
        fill: App.hexFill('0F172A'),
        border: App.makeBorder('1E293B')
      });
      App.styleCell(ws.getCell(rowNo, 2), {
        font: { color: { argb: 'E5E7EB' } },
        fill: App.hexFill('0F172A'),
        border: App.makeBorder('1E293B')
      });
    });

    const headerRowNo = 8;
    const headerRow = ws.getRow(headerRowNo);
    ['Div', 'NIK', 'Nama', ...item.dayColumns].forEach((value, idx) => {
      const cell = headerRow.getCell(idx + 1);
      cell.value = value;
      App.styleCell(cell, {
        font: { bold: true, color: { argb: 'FFFFFFFF' } },
        alignment: { horizontal: 'center', vertical: 'middle' },
        fill: App.hexFill('111827'),
        border: App.makeBorder('334155')
      });
    });
    headerRow.height = 24;

    item.workers.forEach((worker, idx) => {
      const rowNo = headerRowNo + 1 + idx;
      const row = ws.getRow(rowNo);
      [worker.divisi, worker.nik, worker.nama].forEach((value, c) => {
        const cell = row.getCell(c + 1);
        cell.value = value;
        App.styleCell(cell, {
          font: { color: { argb: 'E2E8F0' }, bold: c < 2 },
          alignment: { vertical: 'middle', horizontal: c === 0 ? 'center' : 'left' },
          fill: App.hexFill(idx % 2 === 0 ? '020617' : '0B1120'),
          border: App.makeBorder('1E293B')
        });
      });

      item.dayColumns.forEach((day, dayIdx) => {
        const cell = row.getCell(4 + dayIdx);
        const type = worker.dates[day] || '';
        cell.value = type;
        const typeStyle = type ? App.getTypeStyle(type) : { fill: App.hexFill(idx % 2 === 0 ? '020617' : '0B1120'), fontColor: '475569' };
        App.styleCell(cell, {
          font: { bold: true, color: { argb: typeStyle.fontColor } },
          alignment: { horizontal: 'center', vertical: 'middle' },
          fill: typeStyle.fill,
          border: App.makeBorder('1E293B')
        });
      });
    });

    writeLegend(ws, item, headerRowNo + item.workers.length + 3);
  }

  function writeLegend(ws, item, startRow) {
    ws.getCell(startRow, 1).value = 'Legenda';
    App.styleCell(ws.getCell(startRow, 1), {
      font: { bold: true, color: { argb: 'F8FAFC' } },
      fill: App.hexFill('111827'),
      border: App.makeBorder('334155')
    });

    let rowNo = startRow + 1;
    Object.keys(item.summary.types).sort().forEach(type => {
      const c1 = ws.getCell(rowNo, 1);
      const c2 = ws.getCell(rowNo, 2);
      c1.value = type;
      c2.value = item.summary.types[type];
      const typeStyle = App.getTypeStyle(type);
      App.styleCell(c1, {
        font: { bold: true, color: { argb: typeStyle.fontColor } },
        alignment: { horizontal: 'center' },
        fill: typeStyle.fill,
        border: App.makeBorder('334155')
      });
      App.styleCell(c2, {
        font: { color: { argb: 'E2E8F0' } },
        fill: App.hexFill('0F172A'),
        border: App.makeBorder('334155')
      });
      rowNo += 1;
    });
  }

  function writeScoreSheet(workbook, plan) {
    const item = plan.item;
    const ws = workbook.addWorksheet(plan.scoreSheetName);
    ws.views = [{ state: 'frozen', xSplit: 3, ySplit: 10 }];
    ws.properties.defaultRowHeight = 22;
    const dayWidths = item.dayColumns.map(() => ({ width: 6 }));
    ws.columns = [
      { width: 8 }, { width: 18 }, { width: 28 }, ...dayWidths,
      { width: 12 }, { width: 12 }, { width: 12 },
      { width: 8 }, { width: 8 }, { width: 8 }, { width: 8 }, { width: 8 }
    ];

    const lastCol = 3 + item.dayColumns.length + 8;
    ws.mergeCells(1, 1, 1, lastCol);
    ws.getCell(1, 1).value = `NILAI ABSENSI PEMANEN BARU - ${item.meta.unit || item.filename}`;
    App.styleCell(ws.getCell(1, 1), {
      font: { bold: true, size: 16, color: { argb: 'FFFFFFFF' } },
      alignment: { horizontal: 'center', vertical: 'middle' },
      fill: App.hexFill('064E3B')
    });
    ws.getRow(1).height = 26;

    const metaRows = [
      ['Perkebunan', item.meta.perkebunan || '-'],
      ['Region', item.meta.region || '-'],
      ['PT', item.meta.pt || '-'],
      ['Unit', item.meta.unit || '-'],
      ['Periode', item.meta.periode || '-'],
      ['Bulan', App.prettyDate(item.monthKey)],
      ['Aturan', 'K=5; M=0; O=5; C=0 tidak dihitung pembagi; S pertama=4, S kedua=3, S ketiga=2, S keempat dan seterusnya=1']
    ];

    metaRows.forEach((meta, i) => {
      const rowNo = 2 + i;
      ws.getCell(rowNo, 1).value = meta[0];
      ws.getCell(rowNo, 2).value = meta[1];
      ws.mergeCells(rowNo, 2, rowNo, lastCol);
      App.styleCell(ws.getCell(rowNo, 1), {
        font: { bold: true, color: { argb: 'BBF7D0' } },
        fill: App.hexFill('052E16'),
        border: App.makeBorder('14532D')
      });
      App.styleCell(ws.getCell(rowNo, 2), {
        font: { color: { argb: 'ECFDF5' }, bold: i === 6 },
        alignment: { wrapText: true, vertical: 'middle' },
        fill: App.hexFill('064E3B'),
        border: App.makeBorder('14532D')
      });
    });

    const headerRowNo = 10;
    const headers = [
      'Div', 'NIK', 'Nama', ...item.dayColumns,
      'Total Nilai', 'Pembagi', 'Nilai Rata-rata', 'K', 'M', 'O', 'C', 'S'
    ];
    headers.forEach((value, idx) => {
      const cell = ws.getRow(headerRowNo).getCell(idx + 1);
      cell.value = value;
      App.styleCell(cell, {
        font: { bold: true, color: { argb: 'FFFFFFFF' } },
        alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
        fill: App.hexFill('166534'),
        border: App.makeBorder('22C55E')
      });
    });
    ws.getRow(headerRowNo).height = 28;

    const scoredWorkers = App.calculateFileScores(item);
    scoredWorkers.forEach((worker, idx) => {
      const rowNo = headerRowNo + 1 + idx;
      const row = ws.getRow(rowNo);
      [worker.divisi, worker.nik, worker.nama].forEach((value, c) => {
        const cell = row.getCell(c + 1);
        cell.value = value;
        App.styleCell(cell, {
          font: { color: { argb: 'E2E8F0' }, bold: c < 2 },
          alignment: { vertical: 'middle', horizontal: c === 0 ? 'center' : 'left' },
          fill: App.hexFill(idx % 2 === 0 ? '022C22' : '052E16'),
          border: App.makeBorder('14532D')
        });
      });

      item.dayColumns.forEach((day, dayIdx) => {
        const cell = row.getCell(4 + dayIdx);
        const code = worker.dates[day] || '';
        const scoreValue = worker.score.scoresByDay[day];
        cell.value = scoreValue === null || scoreValue === undefined ? '' : scoreValue;
        const typeStyle = code ? App.getTypeStyle(code) : { fill: App.hexFill(idx % 2 === 0 ? '022C22' : '052E16'), fontColor: '6B7280' };
        App.styleCell(cell, {
          font: { bold: true, color: { argb: typeStyle.fontColor } },
          alignment: { horizontal: 'center', vertical: 'middle' },
          fill: typeStyle.fill,
          border: App.makeBorder('14532D'),
          numFmt: '0.00'
        });
        if (code === 'C') cell.note = 'C bernilai 0 tetapi tidak menjadi pembagi rata-rata.';
        if (code === 'S') cell.note = worker.score.notesByDay[day];
      });

      const startSummaryCol = 4 + item.dayColumns.length;
      const summaryValues = [
        worker.score.totalScore,
        worker.score.divisor,
        worker.score.average,
        worker.score.counts.K,
        worker.score.counts.M,
        worker.score.counts.O,
        worker.score.counts.C,
        worker.score.counts.S
      ];
      summaryValues.forEach((value, i) => {
        const cell = row.getCell(startSummaryCol + i);
        cell.value = value;
        App.styleCell(cell, {
          font: { bold: i === 2, color: { argb: i === 2 ? 'FDE68A' : 'E2E8F0' } },
          alignment: { horizontal: 'center', vertical: 'middle' },
          fill: App.hexFill(i === 2 ? '78350F' : (idx % 2 === 0 ? '022C22' : '052E16')),
          border: App.makeBorder('14532D'),
          numFmt: i === 2 ? '0.00' : '0'
        });
      });
    });

    const legendStart = headerRowNo + scoredWorkers.length + 3;
    const rules = [
      ['Kode', 'Nilai', 'Masuk Pembagi', 'Keterangan'],
      ['K', 5, 'Ya', 'Kerja/Hadir'],
      ['M', 0, 'Ya', 'Mangkir/tidak masuk tetap menjadi pembagi'],
      ['O', 5, 'Ya', 'Off dihitung nilai penuh'],
      ['C', 0, 'Tidak', 'Cuti tidak menjadi pembagi rata-rata'],
      ['S ke-1', 4, 'Ya', 'S pertama dalam bulan berjalan'],
      ['S ke-2', 3, 'Ya', 'S kedua dalam bulan berjalan'],
      ['S ke-3', 2, 'Ya', 'S ketiga dalam bulan berjalan'],
      ['S ke-4 dst', 1, 'Ya', 'S lebih dari 3 kali dalam bulan berjalan']
    ];
    rules.forEach((rule, rIdx) => {
      const row = ws.getRow(legendStart + rIdx);
      rule.forEach((value, cIdx) => {
        const cell = row.getCell(cIdx + 1);
        cell.value = value;
        App.styleCell(cell, {
          font: { bold: rIdx === 0, color: { argb: rIdx === 0 ? 'FFFFFFFF' : 'E2E8F0' } },
          alignment: { horizontal: cIdx === 1 || cIdx === 2 ? 'center' : 'left', vertical: 'middle', wrapText: true },
          fill: App.hexFill(rIdx === 0 ? '166534' : '052E16'),
          border: App.makeBorder('14532D')
        });
      });
    });
  }

  App.exportWorkbook = async function exportWorkbook() {
    if (!App.state.files.length) {
      alert('Belum ada file untuk dikonversi.');
      return;
    }
    if (typeof ExcelJS === 'undefined') {
      alert('Library ExcelJS belum siap. Coba tunggu sebentar lalu klik lagi.');
      return;
    }

    App.dom.btnExport.disabled = true;
    App.dom.btnExport.textContent = 'Memproses...';

    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'ChatGPT';
      workbook.created = new Date();
      workbook.modified = new Date();
      workbook.properties.date1904 = false;

      const sheetPlan = makeSheetPlan(App.state.files);
      writeSummarySheet(workbook, sheetPlan);
      sheetPlan.forEach(plan => {
        writeAttendanceSheet(workbook, plan);
        writeScoreSheet(workbook, plan);
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const safeName = (App.dom.outputName.value || 'konversi_absensi').trim().replace(/[^a-zA-Z0-9_-]+/g, '_') || 'konversi_absensi';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${safeName}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      console.error(error);
      alert(error.message || 'Gagal membuat file XLSX.');
    } finally {
      App.dom.btnExport.disabled = App.state.files.length === 0;
      App.dom.btnExport.textContent = 'Download XLSX';
    }
  };
})(window);
