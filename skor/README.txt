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
