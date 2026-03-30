VERSI MODIFIKASI - Sekolah Pemanen

Perbaikan utama:
1. Login mobile lebih aman:
   - Saat login gagal dari data lokal, aplikasi otomatis mencoba mengambil master user terbaru dari server lalu mencocokkan ulang NIP/PIN.
   - Mengurangi kasus "NIP atau PIN tidak cocok" di Chrome Mobile ketika data user belum tertarik ke local storage.

2. Pull / Tes Koneksi / Bootstrap tidak lagi dipaksa lewat JSONP:
   - Sekarang aplikasi memprioritaskan POST text/plain untuk Chrome Mobile.
   - JSONP tetap disediakan sebagai fallback darurat untuk request kecil.
   - Format JSONP juga diperkuat dengan callback query langsung.

3. Progress bar dan overlay proses:
   - Login
   - Sync
   - Pull
   - Tes koneksi
   - Setup sheet
   - Simpan pengaturan
   Overlay ini membantu user tahu proses masih berjalan dan mencegah klik tombol berulang.

4. Penyegaran cache lokal:
   - Versi storage dan IndexedDB dinaikkan supaya browser memakai struktur lokal versi terbaru.

File yang dimodifikasi:
- index.html
- styles.css
- app.js
- Code.gs

Langkah implementasi:
1. Ganti file frontend lama dengan file versi modifikasi ini.
2. Copy-paste ulang Code.gs ke Google Apps Script lalu deploy ulang Web App.
3. Pastikan deploy sebagai:
   - Execute as: Me
   - Who has access: Anyone
4. Setelah deploy, buka aplikasi lalu Tes Koneksi.
5. Login ulang dari Chrome Mobile.

Catatan:
- Jika URL Web App berubah setelah deploy baru, perbarui GAS URL pada menu Pengaturan.
- Untuk hasil paling stabil di mobile, lakukan Pull sekali setelah login pertama berhasil.
