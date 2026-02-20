# Arsitektur Data – Sekolah Pemanen (Google Sheets)

Dokumen ini adalah **template struktur tabel/sheet** yang digunakan oleh aplikasi Web + Google Apps Script (GAS).

> Catatan: semua kolom bertipe teks di Google Sheets, kecuali tanggal disarankan format ISO `YYYY-MM-DD` dan timestamp `YYYY-MM-DDTHH:mm:ss`.

---

## 1) Settings
**Sheet:** `Settings`

| Kolom | Keterangan |
|---|---|
| key | kunci konfigurasi |
| value | nilai konfigurasi |

Contoh key penting:
- `appTitle` = Sekolah Pemanen
- `orgName` = Karyamas Plantation
- `activeProgramId` = (program_id)
- `darkModeDefault` = TRUE/FALSE

---

## 2) Users (Login & Role)
**Sheet:** `Users`

| Kolom | Keterangan |
|---|---|
| user_id | ID unik |
| nik | NIK / username |
| name | nama |
| role | `ADMIN` / `ASISTEN` / `MANDOR` / `MENTOR` / `PESERTA` |
| estate | opsional |
| unit | opsional |
| active | TRUE/FALSE |
| pin | PIN sederhana (demo) |
| created_at | timestamp |
| updated_at | timestamp |

---

## 3) Programs (Batch Sekolah Pemanen)
**Sheet:** `Programs`

| Kolom | Keterangan |
|---|---|
| program_id | ID unik batch |
| name | nama program/batch |
| period_start | tanggal mulai |
| period_end | tanggal selesai |
| location | lokasi (estate/TC) |
| quota | kuota |
| status | `DRAFT` / `ACTIVE` / `CLOSED` |
| created_by | nik admin |
| created_at | timestamp |

---

## 4) Candidates (Calon)
**Sheet:** `Candidates`

| Kolom | Keterangan |
|---|---|
| candidate_id | ID unik |
| nik | NIK calon |
| name | nama |
| gender | L/P |
| dob | tanggal lahir |
| phone | no hp |
| address | alamat |
| education | pendidikan |
| source | sumber rekrut |
| applied_at | timestamp daftar |
| admin_status | `DRAFT`/`SUBMITTED`/`VERIFIED`/`REJECTED` |
| admin_notes | catatan |
| docs_ktp | link/drive url |
| docs_kk | link |
| docs_skck | link |
| docs_health | link surat sehat |
| photo_url | link foto |
| verified_by | nik verifikator |
| verified_at | timestamp |

---

## 5) SelectionResults (Seleksi Lapangan)
**Sheet:** `SelectionResults`

| Kolom | Keterangan |
|---|---|
| selection_id | ID unik |
| program_id | relasi batch |
| candidate_id | relasi calon |
| ts | timestamp input |
| tes_fisik_score | nilai |
| tes_fisik_pass | TRUE/FALSE |
| tes_panen_score | nilai |
| tes_panen_pass | TRUE/FALSE |
| tes_karakter_score | nilai |
| tes_karakter_pass | TRUE/FALSE |
| recommend_category | A/B/C (sistem) |
| final_category | A/B/C (keputusan) |
| decision | `APPROVED`/`REJECTED` |
| decided_by | nik penentu |
| decided_at | timestamp |
| notes | catatan |

---

## 6) Participants (Peserta Aktif Sekolah)
**Sheet:** `Participants`

| Kolom | Keterangan |
|---|---|
| participant_id | ID unik |
| program_id | relasi batch |
| candidate_id | relasi calon |
| nik | nik peserta |
| name | nama peserta |
| category | A/B |
| status | `ORIENTASI`/`TANDEM`/`ONJOB`/`GRADUATED`/`FAILED` |
| start_date | mulai |
| end_date | selesai |
| mentor_id | relasi mentor (khusus B) |
| estate | estate |
| divisi | divisi |
| ancak | ancak/areal |
| trial_start | mulai masa percobaan 3 bulan |
| trial_end | akhir masa percobaan |
| created_at | timestamp |
| updated_at | timestamp |

---

## 7) Mentors (Calon Mentor / Mentor)
**Sheet:** `Mentors`

| Kolom | Keterangan |
|---|---|
| mentor_id | ID unik |
| nik | nik mentor |
| name | nama |
| estate | estate |
| divisi | divisi |
| active | TRUE/FALSE |
| experience_years | pengalaman |
| notes | catatan |
| created_at | timestamp |

---

## 8) Pairings (Pairing Mentor–Mentee)
**Sheet:** `Pairings`

| Kolom | Keterangan |
|---|---|
| pairing_id | ID unik |
| program_id | relasi batch |
| mentor_id | relasi mentor |
| participant_id | relasi peserta |
| start_date | mulai |
| end_date | selesai |
| status | `ACTIVE`/`ENDED` |
| assigned_by | nik asisten/admin |
| assigned_at | timestamp |

---

## 9) DailyLogs (Monitoring Harian)
**Sheet:** `DailyLogs`

| Kolom | Keterangan |
|---|---|
| log_id | ID unik |
| program_id | relasi batch |
| participant_id | relasi peserta |
| date | YYYY-MM-DD |
| attendance | `HADIR`/`SAKIT`/`IZIN`/`ALPA` |
| tonnage | ton/HK (angka teks) |
| mutu_grade | grading ringkas |
| losses_brondolan | catatan losses |
| apd_ok | TRUE/FALSE |
| discipline_score | 0-100 |
| mentor_note | catatan mentor |
| mandor_note | catatan mandor |
| assistant_note | catatan asisten |
| created_by | nik penginput |
| created_at | timestamp |

---

## 10) WeeklyRecaps (Evaluasi Mingguan)
**Sheet:** `WeeklyRecaps`

| Kolom | Keterangan |
|---|---|
| recap_id | ID unik |
| program_id | relasi batch |
| participant_id | relasi peserta |
| week_no | 1.. |
| week_start | YYYY-MM-DD |
| week_end | YYYY-MM-DD |
| avg_tonnage | rata-rata |
| avg_mutu | ringkas |
| losses_rate | ringkas |
| attendance_pct | 0..100 |
| apd_pct | 0..100 |
| discipline_avg | 0..100 |
| recommendation | rekomendasi |
| reviewed_by | nik reviewer |
| reviewed_at | timestamp |

---

## 11) Graduations (Kelulusan)
**Sheet:** `Graduations`

| Kolom | Keterangan |
|---|---|
| grad_id | ID unik |
| program_id | relasi batch |
| participant_id | relasi peserta |
| decision | `LULUS`/`TIDAK_LULUS` |
| lulus_flag | TRUE/FALSE |
| reason | alasan (wajib jika tidak lulus) |
| approved_by | nik approver |
| approved_at | timestamp |

---

## 12) Certificates (Sertifikat Peserta & Mentor)
**Sheet:** `Certificates`

| Kolom | Keterangan |
|---|---|
| cert_id | ID unik |
| program_id | relasi batch |
| person_type | `PESERTA`/`MENTOR` |
| person_id | participant_id / mentor_id |
| nik | nik |
| name | nama |
| certificate_no | nomor sertifikat |
| issue_date | YYYY-MM-DD |
| template | nama template |
| issued_by | nik penerbit |
| issued_at | timestamp |
| pdf_url | link pdf (opsional) |

---

## 13) MentorIncentives (Insentif Mentor)
**Sheet:** `MentorIncentives`

| Kolom | Keterangan |
|---|---|
| incentive_id | ID unik |
| program_id | relasi batch |
| mentor_id | relasi mentor |
| participant_id | relasi mentee |
| stage | `AFTER_TRIAL_3M` / `AFTER_1Y` |
| amount | nominal |
| due_date | tanggal jatuh tempo |
| status | `PENDING`/`VERIFIED`/`PAID`/`CANCELLED` |
| verified_by | nik |
| verified_at | timestamp |
| paid_at | timestamp |
| notes | catatan |

---

## 14) Sessions (Token Login)
**Sheet:** `Sessions`

| Kolom | Keterangan |
|---|---|
| token | token |
| role | role |
| nik_or_user | nik |
| expires_at | timestamp |
| created | timestamp |

---

## 15) AuditLogs (Jejak Aksi)
**Sheet:** `AuditLogs`

| Kolom | Keterangan |
|---|---|
| audit_id | ID unik |
| ts | timestamp |
| user_nik | nik |
| action | aksi |
| entity | entitas |
| entity_id | id |
| detail_json | json ringkas |



## Tambahan (Patch v2)
- DailyLogs: tambah kolom `mentor_id` dan `updated_at`.
- Certificates: tambah kolom `verify_code`, `drive_file_id`, `qr_url`.
- Settings keys (opsional):
  - `certFolderId` (Google Drive folder id untuk PDF sertifikat)
  - `incentive_3m_amount`, `incentive_12m_amount` (nominal)
  - `incentive_3m_enabled`, `incentive_12m_enabled` (TRUE/FALSE)
