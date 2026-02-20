# Deployment (Web + Google Sheets + GAS)

## A) Buat Spreadsheet
1. Buat Google Spreadsheet baru.
2. Buat sheet sesuai folder `data/templates/*.csv` (nama sheet harus sama).
3. Copy header kolom (baris 1) dari CSV ke masing-masing sheet.

## B) Deploy Google Apps Script
1. Extensions -> Apps Script
2. Copy isi file `backend/Code.gs` ke Code.gs di GAS.
3. Di bagian CONFIG, isi:
   - `SPREADSHEET_ID`
4. Deploy -> New deployment -> Web app
   - Execute as: Me
   - Who has access: Anyone with the link (untuk testing internal)
5. Dapatkan URL `/exec` dan isi di `frontend/js/config.js`.

## C) Jalankan Frontend
- Host folder `frontend/` (GitHub Pages / hosting internal).
- Akses `index.html`

## D) Buat User awal (ADMIN)
Di sheet `Users`, buat 1 baris:
- nik: 123
- pin: 1234
- role: ADMIN
- active: TRUE

Silakan ubah sesuai kebijakan.

