APLIKASI SEKOLAH PEMANEN - VERSI LANJUTAN

Perubahan utama:
1. NIP TC001 otomatis sebagai ADMIN.
2. Tab Pengaturan hanya tampil untuk ADMIN.
3. GAS URL dan Spreadsheet ID default sudah ditanamkan dan dapat disimpan ke sheet Config agar user lain bisa menarik konfigurasi online.
4. Sudah ada edit/hapus laporan per record.
5. Dashboard ditambah grafik detail.
6. Database ditambah filter estate, divisi, mandor, rentang tanggal.
7. Export PDF dibuat lebih formal untuk laporan manajemen.

DEFAULT ONLINE:
- GAS URL:
https://script.google.com/macros/s/AKfycbxy-ERQsMybRvnEtsUIk_oEqDBUwfswEp74cWsjVhNzAYeLb3vEo23nnhSUiScWagfH/exec
- Spreadsheet ID:
1B6KmlUCOKGozN6abEhp7nzpJMMm1BylBA-tKIrGZBSA

LANGKAH PAKAI:
1. Deploy Code.gs sebagai Web App (Execute as Me, Access Anyone).
2. Buka index.html.
3. Login awal: NIP TC001 / PIN 1234.
4. Klik Pengaturan > Buat Sheet Otomatis.
5. Simpan Pengaturan agar tersimpan ke sheet Config.
6. Tambahkan master user, estate/divisi, peserta, mentor.
7. Gunakan Sync dan Pull untuk sinkron lokal-online.

CATATAN:
- Bootstrap online akan mencoba menarik Config dan daftar user aktif dari database.
- Untuk login lintas perangkat, pastikan user sudah tersimpan di sheet Users dan lakukan Pull/Sync.
- Jika browser memblokir POST ke Apps Script, aplikasi akan fallback ke JSONP untuk action ringan seperti bootstrap, pull, test connection, dan setup.
