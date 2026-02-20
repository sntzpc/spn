# Flow UI (Wireframe Sederhana) per Role

Notation:
- [ ] = field/input
- ( ) = tombol
- { } = list/table
- -> = navigasi

---

## 1) Login (Semua Role)
**Screen: Login**
- [NIK]
- [PIN]
- (Masuk)
- (Toggle Dark/Light)

Hasil: token disimpan di localStorage.

---

## 2) ADMIN / TC Head

### A. Dashboard
- Ringkasan: Program aktif, jumlah calon, A/B/C, peserta aktif, alert disiplin/APD
- {Program List} (Aktif/Draft/Closed)
- (Buat Program Baru)

### B. Program
**Program Detail**
- [Nama], [Periode], [Lokasi], [Kuota], [Status]
- (Simpan)
- Tab:
  1) Calon
  2) Seleksi
  3) Peserta
  4) Mentor
  5) Monitoring
  6) Kelulusan
  7) Sertifikat
  8) Insentif Mentor

### C. Calon (Administrasi)
- {Candidates Table} filter admin_status
- (Tambah Calon)
- (Verifikasi / Tolak) + catatan
- Form Calon: biodata + link dokumen

### D. Seleksi Lapangan
- {SelectionResults Table} per calon
- (Input Seleksi)
  - [Fisik score], [Panen score], [Karakter score], [Catatan]
  - Sistem tampilkan recommend_category
  - Admin/Askep set final_category + keputusan

### E. Peserta
- {Participants Table} (A/B) + status
- (Generate peserta dari hasil seleksi final A/B)
- (Set penempatan: estate/divisi/ancak)

### F. Mentor & Pairing
- {Mentors Table}
- {Pairings Table}
- (Assign Mentor -> pilih mentor + peserta B + start/end)

### G. Monitoring
- {DailyLogs Table} filter tanggal / peserta
- (Input log manual jika diperlukan)
- (Generate Rekap Mingguan)

### H. Kelulusan
- {Graduations Table}
- (Sidang Kelulusan -> set LULUS/TIDAK + alasan)

### I. Sertifikat
- {Certificates Table}
- (Terbitkan Sertifikat Peserta)
- (Terbitkan Sertifikat Mentor)

### J. Insentif Mentor
- {MentorIncentives Table}
- (Verifikasi) -> (Tandai Paid)

---

## 3) ASISTEN

### A. Dashboard
- Program aktif
- {Peserta Divisi/Unit} + status
- {Pairing di Divisi}

### B. Pairing Mentor
- (Pilih Mentor) + (Pilih Peserta B) + (Simpan)
- Lihat progress mentee

### C. Monitoring
- Input catatan asisten pada DailyLogs
- Review rekap mingguan + rekomendasi tindakan

---

## 4) MANDOR

### A. Monitoring Harian (Utama)
- Filter: [Tanggal], [Divisi], [Peserta]
- {Daftar Peserta}:
  - [Attendance], [Tonnage], [Mutu], [Losses], [APD], [Disiplin], [Catatan]
  - (Simpan cepat)

---

## 5) MENTOR

### A. Dashboard Mentor
- {Mentee aktif}
- Ringkasan target/progres

### B. Log Harian Mentor
- Pilih mentee + tanggal
- [Catatan kemampuan], [Koreksi teknik], [Perilaku/disiplin]
- (Simpan)

---

## 6) PESERTA (opsional read-only)
- Lihat jadwal & progres ringkas
- Lihat status kelulusan
- Download sertifikat (jika tersedia)

