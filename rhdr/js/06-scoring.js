(function (global) {
  'use strict';

  const App = global.AbsensiApp = global.AbsensiApp || {};

  App.SCORE_RULES = {
    K: { score: 5, counted: true, label: 'Kerja / Hadir' },
    M: { score: 0, counted: true, label: 'Mangkir / Tidak masuk' },
    O: { score: 5, counted: true, label: 'Off / Dihitung nilai penuh' },
    C: { score: 0, counted: false, label: 'Cuti / Tidak menjadi pembagi' },
    S: { counted: true, label: 'Sakit / Bertingkat per bulan' }
  };

  App.scoreSByOccurrence = function scoreSByOccurrence(sequence) {
    if (sequence <= 1) return 4;
    if (sequence === 2) return 3;
    if (sequence === 3) return 2;
    return 1;
  };

  App.scoreAttendanceCode = function scoreAttendanceCode(code, sSequence) {
    const upper = String(code || '').trim().toUpperCase();
    if (!upper) return { code: '', score: null, counted: false, note: 'Kosong' };
    if (upper === 'S') {
      return { code: upper, score: App.scoreSByOccurrence(sSequence), counted: true, note: `S ke-${sSequence}` };
    }
    const rule = App.SCORE_RULES[upper];
    if (!rule) return { code: upper, score: null, counted: false, note: 'Kode tidak dikenal' };
    return { code: upper, score: rule.score, counted: rule.counted, note: rule.label };
  };

  App.calculateWorkerScores = function calculateWorkerScores(worker, dayColumns) {
    let sCount = 0;
    let totalScore = 0;
    let divisor = 0;
    const scoresByDay = {};
    const notesByDay = {};
    const counts = { K: 0, M: 0, O: 0, C: 0, S: 0, OTHER: 0 };

    dayColumns.forEach(day => {
      const code = String(worker.dates[day] || '').trim().toUpperCase();
      if (code === 'S') sCount += 1;
      const result = App.scoreAttendanceCode(code, sCount);
      if (code && Object.prototype.hasOwnProperty.call(counts, code)) counts[code] += 1;
      else if (code) counts.OTHER += 1;

      scoresByDay[day] = result.score;
      notesByDay[day] = result.note;
      if (result.counted) {
        totalScore += Number(result.score) || 0;
        divisor += 1;
      }
    });

    const average = divisor > 0 ? Number((totalScore / divisor).toFixed(2)) : 0;
    return { scoresByDay, notesByDay, totalScore, divisor, average, counts };
  };

  App.calculateFileScores = function calculateFileScores(item) {
    return item.workers.map(worker => ({
      ...worker,
      score: App.calculateWorkerScores(worker, item.dayColumns)
    }));
  };

  App.formatScore = function formatScore(value) {
    if (value === null || value === undefined || value === '') return '';
    return Number(value).toFixed(2).replace(/\.00$/, '');
  };
})(window);
