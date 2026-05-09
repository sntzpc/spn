# Konversi Skoring Premi Panen v2

Aplikasi ini dibuat untuk:
1. Upload banyak file premi panen/BHP
2. Hitung skoring produktivitas dan absensi per tenaga kerja per tanggal
3. Simpan data lokal di IndexedDB
4. Filter per bulan, unit, dan rentang tanggal
5. Download hasil ke file XLSX

## Cara pakai
1. Buka `index.html` di browser
2. Pilih satu atau beberapa file `.XLS/.XLSX`
3. Klik **Proses File**
4. Atur filter bila diperlukan
5. Klik **Download XLSX**

## Catatan logika
- Produktivitas hanya dihitung dari baris dengan `Basis 1 > 0`
- Dasar produktivitas: `Quantity / Basis Proporsi 1`
- Skor produktivitas:
  - >110% = 5
  - 100–110% = 4
  - 90–99% = 3
  - 75–89% = 2
  - <75% = 1
- Absensi:
  - 5 bila ada data di tanggal tersebut
  - 0 bila tidak ada data di tanggal tersebut dalam rentang tanggal file/unit

## Sheet output XLSX
- `Rekap Unit`
- `Rekap Tenaga Kerja`
- 1 sheet detail untuk masing-masing unit/file

## Penting
Aplikasi ini menggunakan CDN:
- TailwindCSS
- ExcelJS

Saat pertama kali dibuka, koneksi internet dibutuhkan agar library termuat dengan baik.

## Update logika rata-rata v2.1
- Rata-rata skor produktivitas sekarang hanya memakai skor > 0 sebagai pembagi.
- Skor produktivitas 0 dari tanggal tanpa aktivitas tidak ikut menurunkan rata-rata.
- Rata-rata absensi tetap menghitung skor 0 sebagai tidak hadir pada hari kerja Senin-Sabtu setelah pekerja mulai memiliki data/aktivitas pertama.
- Skor absensi 0 sebelum tanggal aktif pertama pekerja tidak ikut menjadi pembagi.
- Tampilan matriks harian tetap menampilkan angka 0 agar tanggal tanpa aktivitas tetap terlihat, tetapi kolom Rerata memakai aturan pembagi baru di atas.

UPDATE 09-05-2026 - HALAMAN PERBANDINGAN BHP VS PREMI
------------------------------------------------------
1. Ditambahkan halaman baru "Perbandingan BHP vs Premi" pada index.html.
2. Upload 2 file sekaligus:
   - Data BHP / Input Hasil Panen
   - Data Premi
3. Kunci pembanding:
   Unit + Tanggal + NIP + Nama + Blok.
4. Mapping data:
   - BHP Brondol = KG Brondol
   - BHP Janjang = Janjang Netto
   - Premi Brondol = Quantity jika Quantity (Jjg) = 0
   - Premi Janjang = Quantity (Jjg) jika Quantity (Jjg) > 0
   - Rp Premi = Rp. Total Premi
5. Estimasi Rp BHP dihitung dengan rate premi aktual pada data Premi:
   - Rate Brondol = Rp Premi Brondol / Qty Premi Brondol
   - Rate Janjang = Rp Premi Janjang / Qty Premi Janjang
   - Rp BHP = Qty BHP x Rate Premi
6. Hasil dapat di-download ke Excel berisi sheet:
   - Ringkasan
   - Matrik Brondol
   - Matrik Janjang
   - Detail Gabungan
   - Detail BHP
   - Detail Premi

UPDATE 09-05-2026 - MATRIK SELISIH PREMI HARIAN
-------------------------------------------------
1. Download Excel perbandingan sekarang ditambahkan sheet:
   - Matrik Brondol
   - Matrik Janjang
2. Sheet matrik menampilkan akumulasi Selisih Premi per Div/Unit, NIK, Nama, dan tanggal 1 s.d. akhir bulan.
3. Kolom paling kanan berisi Total Selisih Premi per pekerja.
4. Nilai yang memiliki selisih diberi arsiran warna pink.
5. Nilai nol/tidak ada selisih dibiarkan kosong dan tidak diberi arsiran agar mudah dibaca.

UPDATE 09-05-2026 - PERBAIKAN UNIT, DIVISI, DAN URUTAN SHEET
--------------------------------------------------------------
1. Kolom Divisi ditambahkan pada sheet export perbandingan.
2. Data Divisi BHP diambil dari kolom Kemandoran:
   - 11 = Divisi 1
   - 12 = Divisi 2
   - 13 = Divisi 3
   - 14 = Divisi 4
   - dan seterusnya.
3. Data Divisi Premi diambil langsung dari kolom Divisi pada file Premi.
4. Sheet matrik sekarang memakai urutan kolom awal: Unit, Divisi, NIK, Nama.
5. Sheet rekap dan detail sekarang memakai kolom awal: Unit, Divisi, lalu kolom lain.
6. Urutan sheet export Excel perbandingan menjadi:
   - Ringkasan
   - Matrik Brondol
   - Rekap Brondol
   - Matrik Janjang
   - Rekap Janjang
   - Detail BHP
   - Detail Premi
   - Detail Gabungan
