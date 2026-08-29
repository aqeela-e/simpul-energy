# SIMPUL — Sistem Inteligensi Mobilisasi Penyimpanan Energi Lintas-Pulau

Prototype platform kecerdasan energi nasional untuk memprediksi kebutuhan
penyimpanan (BESS) antar-microgrid di kepulauan Indonesia Timur, dan
menentukan pre-positioning unit BESS secara adaptif sebelum defisit energi
terjadi — dikirim lintas pulau melalui jalur Tol Laut. Seluruh data yang ditampilkan adalah data simulasi.

## Menjalankan secara lokal

```bash
npm install
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000) di browser.

Untuk build produksi:

```bash
npm run build
npm run start
```

## Struktur halaman & pemetaan modul (M0–M7)

Arsitektur pada esai mendefinisikan delapan modul fungsional (Tabel 2). Setiap
halaman di prototipe ini secara eksplisit diberi label modul yang diimplementasikannya:

| Route | Modul esai | Deskripsi |
|---|---|---|
| `/` | — | Landing page + pemilihan peran (Admin PLN, Operator Tol Laut, Teknisi Microgrid, Portal Publik) |
| `/dashboard` | Ringkasan lintas modul | Status energi & BESS seluruh wilayah, dampak SIMPUL vs alokasi statis |
| `/map` | **M0** — Peta Jaringan Nasional | Peta nasional real-time (Leaflet + OpenStreetMap) — posisi microgrid & jalur distribusi BESS |
| `/microgrids` | **M2** — Kembaran Digital Sistem | Daftar microgrid dengan komposisi EBT dan status risiko |
| `/microgrids/[id]` | **M1 + M2** | Digital twin per-microgrid, ditambah panel Lapisan Data Hibrida (pelaporan warga & anomali cahaya malam) |
| `/forecast` | **M1 + M3** — Kecerdasan EBT & Mesin Prediksi Risiko | Skor risiko gabungan (hosting capacity EBT + darurat) via simulasi Monte Carlo, bukan dua indikator terpisah |
| `/allocation` | **M4 + M5** — Alokasi Spasial & Penempatan/Logistik | Multi-objective scoring dengan jendela transportasi laut diskret (jadwal Tol Laut, bukan waktu tempuh kontinu) |
| `/simulation` | **M6** — Simulasi & Evaluasi Dampak | Perbandingan before/after: alokasi statis vs alokasi adaptif |
| `/audit` | **M7** — Dasbor Transparansi | Ledger keputusan alokasi yang di-hash (SHA-256), human-in-the-loop, dapat diverifikasi publik |

### Kesetiaan terhadap konsep esai

Beberapa elemen yang secara eksplisit disebut sebagai pembeda/kebaruan SIMPUL
pada Bagian C.4 esai, dan bagaimana masing-masing diimplementasikan:

- **Model jendela transportasi laut diskret** (bukan waktu tempuh kontinu) —
  `src/lib/seaTransport.ts` mendefinisikan jadwal kapal Tol Laut per rute
  (hari berlayar tertentu, bukan tersedia tiap hari), dipakai di `/allocation`
  untuk menghitung tanggal keberangkatan berikutnya secara real-time.
- **Skor risiko gabungan** (hosting capacity EBT + darurat, disatukan menjadi
  satu skor prioritas) — tiap microgrid punya `hostingCapacityRisk` dan
  `emergencyRisk` terpisah di `src/lib/data.ts`, ditampilkan sebagai dua bar
  terpisah di `/forecast` yang digabung jadi satu "Skor Prioritas Gabungan".
- **Human-in-the-loop & audit trail** — rekomendasi alokasi tidak dieksekusi
  otomatis; perlu persetujuan Admin PLN dan tercatat di `/audit` dengan hash.
- **Lapisan data hibrida M1** (pelaporan warga + anomali cahaya malam satelit
  sebagai proksi untuk wilayah bersensor terbatas) — ditampilkan di panel
  "M1 — Lapisan Data Hibrida" pada halaman detail microgrid & forecast.

## Stack

- **Next.js 16** (App Router, Turbopack)
- **React 19** + **TypeScript**
- **Tailwind CSS v4** — didefinisikan lewat `@import "tailwindcss";` di `src/app/globals.css` (bukan direktif lawas `@tailwind base/components/utilities`, yang tidak lagi memicu content-scanning penuh di v4)
- **React Leaflet + OpenStreetMap** (tile standar, tanpa API key) — peta nasional
- **Framer Motion** — transisi & animasi antarmuka
- **Recharts** — grafik prediksi
- **Lucide React** — ikon

## Kontrol akses berbasis peran (RBAC)

Setiap peran hanya melihat menu dan halaman yang relevan dengan tugasnya —
ini ditegakkan di dua tempat:

- `src/lib/permissions.ts` — matriks akses (`ROUTE_ACCESS`), halaman utama
  tiap peran (`HOME_ROUTE`), dan catatan cakupan yang ditampilkan di banner.
- `src/hooks/useRoleGuard.ts` — dipakai di setiap halaman: redirect ke `/`
  kalau belum login, atau ke halaman utama perannya kalau peran tsb tidak
  berhak mengakses rute yang diminta (termasuk lewat URL langsung).

| Peran | Halaman yang bisa diakses | Catatan |
|---|---|---|
| Admin PLN | Semua halaman | Akses penuh, termasuk prediksi, alokasi, simulasi |
| Operator Tol Laut | Peta, Microgrid | Bisa konfirmasi status pengiriman BESS di panel transit |
| Teknisi Microgrid | Peta, Microgrid | Hanya melihat microgrid wilayah tugasnya (NTT); bisa konfirmasi kedatangan & integrasi BESS |
| Portal Publik | Dashboard, Audit Trail | Ringkasan agregat saja, tidak bisa membuka detail per-lokasi |

Sesi login disimpan di `sessionStorage` (lihat `AuthContext.tsx`) supaya
refresh halaman tidak melempar pengguna kembali ke layar login.

## Peta interaktif

Peta di `/map` dirender lewat `src/components/IndonesiaMap.tsx`, yang secara
dinamis (client-only, `ssr:false`) me-load `src/components/LeafletMap.tsx` —
peta **Leaflet + tile OpenStreetMap standar** (`tile.openstreetmap.org`,
**tanpa API key, tanpa watermark**), bukan bentuk digambar sendiri. Di atas
tile peta tsb digambar overlay animasi custom:

- **Marker status** microgrid (normal/peringatan/kritis) dengan ring
  berdenyut untuk status kritis.
- **Jalur BESS** sebagai kurva bezier antara dua titik lat/lng asli, dengan
  posisi marker mengikuti **progres transit riil** (lihat bagian "Real-time"
  di bawah), bukan animasi loop yang tidak berarti.
- **Comet trail** — beberapa titik memudar tepat di belakang posisi riil,
  menunjukkan arah pergerakan tanpa menyiratkan kecepatan palsu.
- **Radar sweep** — indikator lingkaran kecil di pojok peta, dekoratif.

Karena tile di-fetch dari server publik OpenStreetMap, pastikan environment
yang menjalankan `npm run dev`/`npm run start` punya akses internet keluar ke
domain `tile.openstreetmap.org`.

## Real-time

Beberapa bagian aplikasi mengikuti waktu nyata (bukan tanggal/jam statis):

- **Jam sistem** (`src/lib/liveClock.ts`, `useLiveClock`) — dipakai di header
  dashboard dan panel peta, memperbarui setiap detik mengikuti WIB
  (`Asia/Jakarta`). Sengaja dimulai dari `null` di server lalu diisi setelah
  mount di client, supaya tidak terjadi hydration mismatch di Next.js.
- **Progres transit BESS** (`TRANSIT_INFO` di `src/lib/data.ts`,
  `getTransitProgress`) — dihitung dari `departedAt` (waktu keberangkatan)
  vs waktu sekarang, sehingga ETA yang ditampilkan ("Tiba dalam 1 hari 7 jam
  22 menit") benar-benar berkurang seiring waktu berjalan, dan posisi marker
  di peta bergerak sesuai progres riil tersebut.
- **Jendela keberangkatan kapal** (`src/lib/seaTransport.ts`,
  `nextSailingDate`) — dihitung dari hari-berlayar tiap rute dibanding
  tanggal sekarang, bukan tanggal contoh yang di-hardcode.

## Desain

Tema visual menggunakan palet terang (light theme) — putih/abu muda dengan
aksen teal, amber, merah, dan biru — didefinisikan sebagai CSS custom
properties di `:root` dalam `globals.css` (`--bg-card`, `--text-primary`,
`--accent-teal`, dst). Mengubah nilai-nilai ini akan mengubah tampilan di
seluruh aplikasi karena hampir semua komponen mereferensikan variabel
tersebut, bukan warna hardcode.

## Branding

Logo SIMPUL berada di `public/logo-icon.png` (mark persegi, dipakai di navbar
& hero) dan `public/logo_simpul.png` (logo lengkap dengan wordmark). Favicon
di-generate otomatis dari mark tersebut.

## Data

Seluruh data microgrid, unit BESS, dan riwayat keputusan alokasi bersifat
statis/simulasi, didefinisikan di `src/lib/data.ts`. Untuk mengintegrasikan
data nyata, ganti sumber data di file tersebut dengan pemanggilan API/DB.

## Final Prototype Workflow
The prototype now uses a shared client-side operational state (`SimpulContext`) so citizen reports, incidents, recommendations, approvals, shipments, notifications and audit entries are connected rather than isolated page mockups. State is persisted in browser `localStorage` for the prototype.

Operational routes include `/reports`, `/shipments`, and `/public`. Existing routes remain available. Recommendation review supports approve/reject/manual override, shipment lifecycle supports dispatch/transit/delay/arrival/integration, and notifications plus audit records are generated from state-changing actions.

## SIMPUL — Final Competition Demo Flow

Prototype ini menggunakan simulated operational data dengan shared client state. Mock data dipakai untuk skenario kompetisi, tetapi action workflow mengubah state aplikasi dan tercatat di audit.

### Demo utama yang disarankan
1. Login sebagai **Admin PLN**.
2. Buka **Peta Nasional**: lihat microgrid paling kritis dan koridor rekomendasi BESS menuju lokasi tersebut.
3. Buka **Forecast** untuk melihat prediksi generation/load dan risk.
4. Buka **Allocation**: gunakan recommendation awal atau Generate Recommendation.
5. Review score, breakdown, kandidat alternatif, dan discrete maritime window.
6. **Approve**, **Reject**, atau **Override** recommendation.
7. Jika approved/modified, buat **Shipment**.
8. Login sebagai **Operator Tol Laut** untuk Dispatch → In Transit → Delay bila diperlukan.
9. Login sebagai **Teknisi Microgrid** untuk Confirm Arrival → Confirm Integration → Operational pada shipment menuju Kupang.
10. Buka **Simulation** untuk membandingkan Static Allocation vs SIMPUL Adaptive pada baseline, demand spike, generation drop, BESS unavailable, transport delay, dan disaster.
11. Buka **Audit** untuk memverifikasi decision ledger SHA-256 berantai.
12. Buka **Public** sebagai Portal Publik untuk melihat aggregated transparency metrics.

### Data flow
Citizen Report → Verification → Incident → Dynamic Risk → Priority → BESS Matching → Human Approval → Shipment → Transit → Arrival → Integration → Operational → Audit/Analytics.

### Reset demo
State operasional disimpan di localStorage agar perubahan antar-route tetap ada. Untuk mengulang skenario dari awal, hapus site data/localStorage browser untuk origin aplikasi.

## Demo Nasional — Peta & Observasi

Pada M0, peta nasional memiliki dua lapisan visual tambahan untuk demo: **Citra Satelit** (Esri World Imagery) dan **Night-light observation**. Night-light anomaly adalah data simulasi prototype untuk wilayah sensor terbatas dan digunakan sebagai sinyal hybrid, bukan klaim feed satelit real-time.

Koridor prioritas menampilkan arah rekomendasi BESS menuju microgrid dengan composite risk tertinggi. Tombol **Gerakkan kapal demo** menjalankan playback visual pada koridor rekomendasi agar juri dapat melihat mobilisasi secara langsung; progress operasional shipment tetap dihitung dari waktu transit aktual pada state shipment.


## Final Competition Demo Flow

Recommended 3–5 minute demo:

1. **Peta Nasional** → pilih **Citra Satelit** dan **Night-light observation**.
2. Tunjukkan **Koridor Prioritas SIMPUL** dari BESS kandidat menuju microgrid paling kritis.
3. Klik **Gerakkan kapal demo** untuk memperlihatkan vessel playback di koridor prioritas.
4. Buka **Prediksi / Risiko** untuk melihat forecast dan risk.
5. Buka **Laporan** → submit citizen report → Admin PLN melakukan **Verify**.
6. Buka **Alokasi BESS** → Generate Recommendation → lihat score, alasan, alternatif, dan maritime window.
7. **Approve / Override / Reject** recommendation.
8. Buka **Shipment** → Create shipment → Dispatch → In Transit → Delay (opsional).
9. Login sebagai **Teknisi Microgrid** → Confirm Arrival → Confirm Integration.
10. Buka **Simulasi** → pilih skenario → Jalankan Simulasi → bandingkan **Static Allocation vs SIMPUL Adaptive**.
11. Buka **Audit Trail** untuk menunjukkan actor, state transition, timestamp, reason, previous hash, dan hash.
12. Buka **Transparansi** untuk menunjukkan aggregated public information.

### Important

The prototype uses simulated operational data, including satellite/night-light anomaly values, because this is a competition prototype. Satellite imagery is presented as a real map imagery layer, while the night-light anomaly metric is simulated and explicitly labelled as a proxy. Mock data does not imply mock workflow: operational actions update the shared application state and generate related notifications/audit records.

## Final competition workflow

1. Login as **Admin PLN**.
2. Open **Peta Nasional**: inspect road/satellite layer, night-light signal, critical node and moving shipment vessel.
3. Open **Forecast**: risk is derived from the same operational microgrid state.
4. Open **Reports**: submit a citizen report → Admin verifies → incident enters the operational state → risk changes.
5. Open **Allocation**: generate recommendation → inspect score breakdown and alternative → Approve / Reject / Override.
6. Open **Shipments**: create shipment from an approved recommendation → Dispatch → In Transit → Delay (ETA shifts) → Arrival → Integration → Operational.
7. Open **Simulation**: run a scenario and compare calculated Static vs SIMPUL Adaptive KPIs.
8. Open **Audit**: verify the decision ledger integrity.
9. Open **Public**: inspect aggregated transparency metrics.

### Verification performed in this package
- ZIP/source integrity check: PASS
- TypeScript/TSX transpile syntax check: PASS
- Internal `@/` import resolution check: PASS
- Full `npm install` / production build could not be executed in this isolated environment because the npm dependency cache is incomplete. Run `npm install` then `npm run build` on the demo machine before presentation.

## FINAL COMPETITION V6 — End-to-end verification checklist

Golden path:
1. Reports: submit -> verify/reject -> verified report creates incident.
2. Incident: confirmed -> active -> resolved; active incidents contribute to dynamic risk.
3. Hybrid data: grid imbalance + sensor coverage + night-light anomaly + citizen reports contribute to composite risk.
4. Allocation: risk/deficit/health/capacity/logistics/suitability rank BESS candidates and expose score breakdown + alternative.
5. Human review: recommendation must be approved/modified before shipment creation.
6. Maritime: route uses discrete sailing days and current clock; shipment stores departure/ETA/delay.
7. Shipment lifecycle: PLANNED -> DISPATCHED -> IN_TRANSIT -> DELAYED/ARRIVED -> INTEGRATED -> OPERATIONAL.
8. Map: operational shipment progress is derived from departure/ETA; demo playback is only a fallback before a real shipment exists.
9. Simulation: baseline/adaptive scenario outputs are calculated from the current Digital Twin and persisted as runs.
10. Audit: every major action creates an actor/role/state/reason/hash-chain entry.
11. Public: dashboard metrics are aggregated from the same operational state.
12. RBAC: route matrix is default-deny; direct URLs must be denied when a role is not authorized.

Run locally before judging:

```bash
npm install
npm run build
npm run dev
```

## Final hardening notes
This release uses a shared operational state for the end-to-end workflow. Technician arrival/integration/operational transitions, action-level role checks, discrete maritime windows, live transit progress, SHA-256 audit verification, simulation output, notifications and public aggregation are implemented in the operational Context. See `FINAL_QA_STATUS.md` for validation status.
