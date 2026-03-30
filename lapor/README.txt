Aplikasi Sekolah Pemanen v2
==========================

Isi paket:
- index.html
- styles.css
- app.js
- Code.gs
- README.txt

Fitur utama:
1. Master data peserta, mentor, estate, divisi
2. Login PIN per user
3. Dashboard statistik
4. Export Excel dan PDF
5. Sheet Google otomatis dibuat lengkap beserta header dan rekap
6. Generate WA untuk Mandor, Asisten, Manager, dan TC Head
7. Light mode dan dark mode, default light mode
8. Penyimpanan lokal + Google Sheets

Struktur sheet Google yang dibuat otomatis:
- Users
- MasterEstateDivisi
- MasterPeserta
- MasterMentor
- LaporanHarian
- RekapAsisten
- RekapManager
- RekapTCHead
- AuditLog

User awal lokal:
- NIP: TC001
- PIN: 1234
- Role: TC_HEAD

Cara pakai singkat:
1. Deploy Code.gs sebagai Web App di Google Apps Script
   - Execute as: Me
   - Who has access: Anyone
2. Buka index.html
3. Login awal dengan TC001 / 1234
4. Isi GAS URL dan Spreadsheet ID pada tab Pengaturan
5. Klik "Buat Sheet Otomatis"
6. Tambahkan master user, estate/divisi, peserta, mentor
7. Login sesuai user masing-masing
8. Mandor input laporan harian
9. Asisten / Manager / TC Head generate rekap WA sesuai otorisasi
10. Gunakan tombol Sync dan Pull untuk sinkron database

Catatan:
- Role MANDOR hanya dapat input laporan dan melihat data miliknya.
- Role ASISTEN melihat data scope estate+divisi sendiri.
- Role MANAGER melihat data scope estate sendiri.
- Role TC_HEAD melihat seluruh data.
- Export Excel/PDF mengambil data rekap sesuai tanggal dan role yang dipilih.
