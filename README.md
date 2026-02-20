# Sekolah Pemanen – Web App (Tailwind + Dark/Light) + Google Sheets/GAS

Paket ini berisi:
- **Frontend**: `frontend/` (SPA sederhana, Tailwind CDN, dark/light mode presisi)
- **Backend**: `backend/Code.gs` (Google Apps Script Web App)
- **Dokumen**: `docs/SCHEMA.md`, `docs/WIREFRAMES.md`, `docs/DEPLOYMENT.md`
- **Template header sheet**: `data/templates/*.csv`

## Fitur (MVP)
1. Login role-based (Users + Sessions)
2. Program: buat program & set sebagai aktif
3. Calon: tambah/edit + verifikasi/tolak
4. Seleksi: input nilai fisik/panen/karakter, auto rekomendasi kategori A/B/C
5. Peserta: generate peserta dari seleksi final A/B, set penempatan (estate/divisi/ancak)
6. Mentor: tambah mentor, assign pairing mentor–mentee (kategori B)
7. Monitoring: input Daily Log, lihat data per tanggal, hitung rekap mingguan
8. Kelulusan: putuskan LULUS/TIDAK, update status peserta, auto buat insentif mentor (jika ada mentor)
9. Sertifikat: terbitkan sertifikat peserta/mentor (pencatatan nomor sertifikat)
10. Insentif: list & verify

## Catatan penting
- Ini **starter kit**: struktur data sudah siap, UI sudah nyaman dipakai, endpoint sudah lengkap untuk proses inti.
- Produksi: disarankan menambahkan kontrol akses lebih ketat, validasi data yang lebih dalam, dan penerbitan PDF sertifikat (Drive) bila dibutuhkan.

Silakan mulai dari `docs/DEPLOYMENT.md`.
