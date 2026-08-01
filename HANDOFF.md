# HANDOFF — baca ini dulu, sebelum apa pun

> Untuk agen AI di sesi baru: file ini menggantikan audit ulang. Baca
> seluruhnya (±5 menit), lalu langsung kerja. Jangan menjelajah kode
> untuk membangun konteks — semua yang mahal untuk ditemukan sudah
> ditulis di sini, termasuk empat bug yang butuh berjam-jam untuk
> dilacak dan **tidak akan terlihat dari membaca kode**.
>
> Aturan main dengan pemilik: Bahasa Indonesia santai ("lo/gue"), dia
> awam total soal coding — jelaskan lewat dampak, bukan nama fungsi.
> Jangan pernah bilang "sudah beres" tanpa bukti dari tes nyata.

**Terakhir diperbarui:** 1 Agustus 2026
**Produksi:** https://nemu-in.vercel.app · **Repo:** github.com/vallendrino-vldr/nemu.in

---

## 1. Apa ini

Nemu.in — pencari calon klien untuk freelancer web Indonesia. Menyisir
data peta untuk UMKM yang **belum punya website**, memberi skor dengan
AI, lalu menuliskan pesan pembuka WhatsApp yang menyebut nama toko itu.

Prinsip yang tidak boleh dilanggar:
- **Nol biaya.** Tidak ada satu pun layanan berbayar. Kalau sebuah solusi
  butuh kartu kredit, cari jalan lain.
- **Pengguna yang menekan "kirim"**, bukan aplikasi. Tidak ada bot
  WhatsApp — hanya link `wa.me` yang sudah terisi. Itu yang menjaga nomor
  pengguna tidak kena banned.
- **Anti "AI slop".** Tidak ada file gambar sama sekali; tekstur, kilau,
  dan bayangan semuanya CSS. Prompt AI melarang eksplisit pembuka
  "Perkenalkan", "solusi terbaik", "di era digital ini".

---

## 2. Kredensial & layanan

Semua nilai asli ada di **`.env.local`** dan **`VERCEL-ENV-IMPORT.txt`**
(keduanya di-gitignore, jangan pernah commit). Jangan tulis ulang nilai
rahasia ke file mana pun yang bisa ter-push.

| Layanan | Peran | Catatan penting |
|---|---|---|
| Supabase `nrkfweqncdvjgmpstzph` | database, auth | region Singapura |
| Vercel `nemu-in` (team `vallendrino`) | hosting | pemilik pernah menghapus & membuat ulang project |
| Google Places API (New) | **pencari utama** | key sudah aktif & teruji |
| Geoapify | pencari cadangan | 3.000/hari, tanpa kartu |
| OSM Overpass | pencari cadangan | tanpa key |
| Gemini | skor + tulis pesan | dua key, di-rotasi |
| Mapbox | peta | **hanya token `pk.`** |

**Akun pemilik:** `vallendrino@gmail.com` dan `vadlyvldr@gmail.com`,
keduanya `super_admin`. Sandi keduanya pernah di-reset ke nilai lemah
atas permintaan pemilik — **tidak ditulis di sini** karena file ini
ter-push ke repo publik. Kalau pemilik terkunci lagi, reset lewat Admin
API Supabase memakai `SUPABASE_SERVICE_ROLE_KEY` dari `.env.local`, lalu
sampaikan nilainya langsung ke pemilik, bukan ke file.

---

## 3. Yang SUDAH terbukti jalan (jangan diaudit ulang)

Semua ini diuji terhadap produksi, bukan asumsi:

- Login email/password — `{"ok":true}` + cookie sesi ter-set
- Pembuatan akun via Admin API + trigger profil & 30 kredit
- Rem anti-ternak akun: 5 lolos, ke-6 ditolak, `anon` dapat 42501
- Skema database: 7 tabel, 11 fungsi, RLS aktif, realtime aktif
- Penguncian fungsi: `anon` ditolak di **semua** RPC sensitif
- Gemini: `gemini-3.5-flash-lite` & `gemini-3.5-flash` di dua key
- Google Places: 10 hasil → 8 punya nomor HP siap-WA
- `/auth/callback` mengembalikan 307 (dulu 404)

**God Mode (migrasi 0005)** — diuji langsung ke database produksi lewat
blok transaksi yang di-*rollback*, jadi tidak ada data uji yang tertinggal
(sudah diverifikasi: nol kunci sisa, nol peringatan sisa, saldo utuh):

| Yang diuji | Hasil |
|---|---|
| `god_stats()` sekali panggil | 19 angka dalam satu putaran (dulu 4 query, ±7 detik) |
| Sakelar penguji **mati** | dipotong 0, `was_free=true` |
| Sakelar penguji **hidup** | dipotong 3, `was_free=false` |
| Ban sesama Super Admin | ditolak, `CANNOT_BAN_ADMIN` |
| Akun kena ban lalu belanja | ditolak, `ACCOUNT_BANNED` |
| Kunci API dibaca dari UI | tersamar `AIzaSy••••JKLM`, rahasianya tidak pernah keluar |
| Non-admin panggil 5 fungsi God | kelimanya `FORBIDDEN` |
| `anon` panggil fungsi God | tidak satu pun bisa |
| User update kolom sendiri | hanya `full_name, avatar_url, locale, last_seen_at, notice` |

Yang **belum** diverifikasi: tampilan dua layar setelah login (Berburu baru
dan `/god`) belum pernah dilihat ter-render, karena masuk butuh sandi
pemilik dan agen tidak boleh mengetiknya. Build dan typecheck bersih, dan
lapisan datanya sudah dibuktikan di atas — tapi mata manusia belum lihat.

---

## 4. EMPAT JEBAKAN — ini yang paling mahal untuk ditemukan ulang

Setiap satu di antaranya pernah bikin aplikasi terlihat "rusak total"
padahal servernya sehat. Jangan ulangi.

### 4.1 Selector Zustand yang mengembalikan array = layar mati
Zustand v5 memakai `useSyncExternalStore`, yang menuntut snapshot
**stabil secara referensi**. Selector seperti
`state => state.leads.filter(...)` membuat array baru tiap render →
React looping → "Maximum update depth exceeded" → seluruh tab mati.

Gejalanya menipu: tab Arsip & Akun mental, tab Peta kosong, tapi Berburu
& God Mode normal — karena hanya tiga yang pertama memakai selector
semacam itu.

**Aturan:** `useLeadStore` hanya boleh mengembalikan state mentah atau
primitif. Turunan dihitung di komponen dengan `useMemo`, memakai
`sellableOf` / `visibleOf` / `mappableOf` dari `store/lead-store.ts`.

### 4.2 Batas waktu Vercel memotong fungsi di tengah jalan
Default Vercel 10 detik. Panggilan Overpass dulu diberi 26 detik →
proses dibunuh **setelah kredit terpotong dan sebelum refund sempat
jalan**. Buktinya: ada catatan `scrape` tanpa catatan `refund`.

Sekarang: `export const maxDuration = 60` di halaman dashboard, tiap
penyedia dibungkus anggaran 20 detik yang mengembalikan array kosong
alih-alih menggantung.

### 4.3 REVOKE dari `anon` saja tidak melakukan apa pun
Postgres memberi EXECUTE ke pseudo-role `PUBLIC` pada setiap fungsi
baru. `anon` dan `authenticated` mewarisi dari sana. Revoke dari keduanya
tidak mengubah apa pun — terbukti dengan menembak endpoint pakai anon key
dan panggilannya **tetap jalan**.

**Aturan:** `revoke ... from public` dulu, baru `grant` eksplisit.

### 4.4 Middleware next-intl merusak rute non-lokal
`/auth/callback` sempat mengembalikan **404** karena middleware bahasa
mencoba menambahkan awalan lokal. Google OAuth tidak akan pernah bisa
selama itu terjadi, seberapa benar pun secret-nya.

**Aturan:** `auth` wajib ada di daftar pengecualian `matcher`.

### 4.5 (bonus) Hiasan tidak boleh mematikan halaman
Brave menolak WebGL → cobe melempar error → seluruh halaman mati.
Apa pun yang sifatnya dekoratif dibungkus `SafeWidget`. Langganan
realtime juga gagal-lunak: browser keras memblokir WebSocket pihak ketiga.

### 4.6 Kolom keluaran bernama `id` bikin fungsi meledak saat dipanggil
`admin_list_api_keys()` dan `god_recent_activity()` sama-sama punya kolom
keluaran bernama `id`. Di dalam badannya, penjaga super_admin ditulis
`where id = auth.uid()` — dan `id` itu ambigu antara kolom keluaran dan
`profiles.id`.

Postgres **menerima definisinya tanpa keluhan** lalu melempar 42702 baru
saat fungsinya benar-benar dipanggil. Artinya migrasi terlihat sukses,
tes "apakah fungsinya ada" lolos, dan barangnya tetap rusak. Ini cuma
ketahuan karena fungsinya benar-benar dieksekusi.

**Aturan:** di fungsi `returns table (...)`, selalu beri alias tabel di
setiap query internal — `where pr.id = auth.uid()`, bukan `where id = ...`.

### 4.7 `next/link` biasa membuang awalan bahasa
`localePrefix: 'as-needed'`, jadi bahasa Inggris hidup di `/en/...` dan
Indonesia di akar. Memakai `Link` dari `next/link` menghasilkan href
mentah, sehingga pengguna berbahasa Inggris yang menekan tombol admin
mendarat di `/god` (Indonesia), bukan `/en/god`.

**Aturan:** selalu `import { Link, redirect } from '@/i18n/routing'`.
Catatan: `redirect` dari next-intl **tidak** bertipe `never`, jadi
TypeScript tidak menyempitkan tipe setelahnya — butuh `return` eksplisit.

---

## 5. Keputusan produk yang lahir dari data lapangan

**"Belum punya website" adalah sinyalnya, bukan "punya nomor WA".**
Sapuan nyata di Yogyakarta radius 5 km via OSM: 306 usaha, 295 tanpa
website, tapi **hanya 4** yang nomornya bisa WhatsApp. Menyaring dengan
syarat nomor HP akan membuang 291 prospek nyata.

Karena itu keterjangkauan menjadi **peringkat**, bukan saringan:
`whatsapp` → `phone` → `visit` → `served`.

**Dengan Google Places angkanya berbalik total**: 10 hasil, 8 di
antaranya bernomor HP. Google jauh lebih kaya. Sumber gratis tetap
dipertahankan sebagai cadangan dan digabung, karena kuota Google
terbatas dan cache membuat pencarian berulang gratis.

---

## 6. PEKERJAAN BERIKUTNYA — prioritas pemilik

### 6.0 God Mode — SELESAI (1 Agustus 2026)
Sekarang rute sendiri di `/god`, bukan tab lagi. Masuk lewat tombol
perisai nila di header aplikasi; tab bar turun dari lima jadi empat slot
untuk semua orang.

Yang sudah jalan: hapus akun (harus mengetik emailnya), ban & buka ban,
kirim peringatan yang muncul di layar user lewat realtime, kelola kunci
Gemini dari UI, saldo admin yang bisa dinaikkan/diturunkan sendiri, rem
darurat, pengumuman global, dan feed aktivitas. Bukti pengujiannya di §3.

Dua keputusan desain yang perlu diketahui penerus:
- **`api_keys` sengaja RLS aktif tanpa satu pun policy.** Itu artinya
  hanya `service_role` yang bisa membacanya. Linter Supabase akan
  menandainya INFO selamanya — itu memang desainnya, jangan "diperbaiki"
  dengan menambah policy.
- **Rotasi kunci di-cache 60 detik per instans.** Kunci yang dimatikan di
  konsol berhenti dipakai dalam waktu ±1 menit, bukan seketika. Untuk
  "stop sekarang juga", rem daruratnya yang instan.

Sisa yang belum: `GEMINI_API_KEY_*` di Vercel masih jadi cadangan. Kalau
semua kunci sudah dipindah ke UI, variabel itu bisa dihapus.

### 6.1 Rombak visual dashboard — SELESAI putaran pertama (1 Agustus 2026)
Penilaian pemilik sebelumnya: *"berantakan, murahan, ga berkelas, ga
fresh, ga profesional, terlalu generik, AI SLOP, warnanya ga menarik"*.

Dikerjakan lewat skill `ui-ux-pro-max` (arah gaya) dan `superdesign`
(draft di canvas), lalu diimplementasikan:
- Layar Berburu sekarang **dibuka oleh angka**, bukan formulir: berapa
  lead siap-WA yang menunggu, berapa total, berapa belum disentuh.
- Tiga kolom input jadi **satu kolom Spotlight**. `parseSpotlight()` di
  `src/lib/spotlight.ts` memecah "kedai kopi di Jogja" pakai " di "
  **terakhir**, dan hasil pecahannya ditampilkan sebagai chip supaya
  pengguna tidak menebak apa yang akan dicari. Radius & lokasi turun jadi
  kontrol sekunder yang bisa dilipat.
- Tangga permukaan mode gelap **dilebarkan** — dulu 4/6/9/13% terlalu
  rapat sehingga semua panel terlihat sebidang. Sekarang
  3.5/5/9/15/19% plus `--surface-float` yang baru.
- **Aksen kedua**: nila (252 74% 60%) sekarang punya pekerjaan sendiri —
  segala yang berbau AI dan seluruh chrome God Mode. Ember tetap untuk
  aksi & uang. Pandan/sambal murni status.
- Cahaya ambient: dua gumpalan radial (ember + nila) hanyut pelan di
  belakang hero. Murni CSS, tetap nol berkas gambar.
- Riwayat sapuan disimpan di localStorage (gratis, per-perangkat).

Berkas desain yang ditinggalkan untuk sesi berikutnya:
- `.superdesign/design-system.md` — **sumber kebenaran visual.** Berisi
  peran tiap warna, batasan keras, dan alasan tiap keputusan.
- `.superdesign/init/` — konteks repo untuk skill superdesign.
- Canvas draft: cari lewat `npx @superdesign/cli@latest` (project
  "Nemu.in — Dashboard & God Mode").

Belum dikerjakan di putaran ini: **kartu lead** masih panel biasa, padahal
dia produk sesungguhnya. Tab Arsip juga belum dirombak (lihat §6.4).

### 6.2 Google OAuth masih mati
Client Secret di dashboard Supabase salah. **Kredensial pemilik sendiri
sudah diverifikasi valid** dengan menembak endpoint token Google (balasan
`invalid_grant`, bukan `invalid_client`). Jadi yang salah adalah nilai
yang tersimpan di Supabase.

Agen **tidak boleh** mengetik API secret ke form mana pun — ini harus
dikerjakan pemilik. Pemilik baru saja membuat OAuth client baru; pastikan
redirect URI-nya persis
`https://nrkfweqncdvjgmpstzph.supabase.co/auth/v1/callback`.

### 6.2b Audit mendalam menghasilkan output kacau
Laporan pemilik: hasilnya error / tidak berfungsi. Belum didiagnosis.
Dugaan awal: `deepAudit` memakai `thinking: true` dengan
`maxOutputTokens: 1_400`; model 3.5 menghabiskan anggaran untuk berpikir
lalu terpotong (gejala MAX_TOKENS yang sama seperti di §4). Coba naikkan
anggaran token atau matikan thinking, lalu uji dengan memanggil
Server Action lewat HTTP seperti di §7.

### 6.3 Verifikasi fitur berbayar di produksi
Belum pernah terbukti jalan end-to-end di produksi: sapuan, skor AI,
tulis pesan, peta. Kodenya benar dan API-nya teruji satu per satu, tapi
rangkaian penuhnya belum. Lakukan begitu env Vercel lengkap.

### 6.4 Utang teknis yang diketahui
- `signUpWithEmail` memakai Admin API karena SMTP belum ada. Kalau nanti
  SMTP dipasang, pindah ke `signUp()` biasa + konfirmasi email, lalu
  longgarkan rate limit.
- Tab Arsip masih tampak berantakan menurut pemilik; hapus per-lead dan
  bersihkan-semua sudah ada, tapi tata letaknya belum dirombak.
- Sandi pemilik saat ini lemah dan harus diganti sebelum aplikasi dipakai
  orang lain.
- `.agents/`, `.claude/`, `skills-lock.json` sengaja di-gitignore.

---

## 7. Cara kerja yang terbukti efektif di proyek ini

Empat bug di bagian 4 **tidak satu pun ditemukan dengan membaca kode.**
Semuanya ditemukan dengan mengukur sistem yang sedang berjalan:

1. **Log produksi Vercel** (`get_runtime_errors`, `get_runtime_logs`) —
   membedakan crash server dari crash browser dalam hitungan detik.
2. **Log auth Supabase** (`get_logs service=auth`) — membuktikan login
   pemilik sebenarnya **berhasil** (`POST /token → 200`) padahal dia
   yakin gagal. Ternyata dia punya dua akun: satu dengan email typo.
3. **Memanggil Server Action lewat HTTP** — ekstrak id action dari bundle
   klien, POST dengan header `Next-Action`. Ini membuktikan login
   produksi bekerja tanpa perlu browser.
4. **Menembak API pihak ketiga langsung** — mengirim kode palsu ke
   endpoint token Google membuktikan kredensial pemilik valid dan
   memindahkan kesalahan ke Supabase.
5. **Menyerang database sendiri dengan anon key** — membuktikan revoke
   pertama tidak berfungsi.

Pelajarannya: **jangan menebak dari kode; ukur sistem yang hidup.**
Dan hati-hati mengira kebisingan sendiri sebagai bug pemilik — error
`a.trim is not a function` yang sempat membingungkan ternyata berasal
dari probe diagnostik sendiri.

---

## 8. Peta file

```
src/
├── actions/          Server Actions — semua jalur berbayar
│   ├── auth.ts       email/password + Google; origin dari header, bukan env
│   ├── hunt.ts       rem → cache → potong → panggil → refund
│   ├── enrich.ts     skor, pesan, audit
│   └── admin.ts      God Mode
├── lib/
│   ├── discovery/    Places > Geoapify > Overpass, digabung & diperingkat
│   ├── gemini.ts     dua key + jeda; 400 → ulang tanpa thinkingConfig
│   ├── credits.ts    penjaga kredit (wasFree mencegah cetak kredit)
│   └── ghost-canvas.ts  Website Hantu → PNG, tanpa library
│   └── spotlight.ts  pecah "kedai kopi di Jogja" + riwayat sapuan
├── components/
│   ├── app-shell.tsx    shell native, 4 tab + tombol admin di header
│   ├── safe-widget.tsx  blast door untuk komponen dekoratif
│   ├── user-notice.tsx  peringatan admin, lewat realtime
│   ├── god/             konsol admin: shell, overview, users, keys,
│   │                    system, activity — ruangan terpisah, aksen nila
│   └── views/           satu file per tab
├── app/[locale]/god/    rute God Mode (peran dibaca ulang dari database)
└── store/lead-store.ts  BACA CATATAN DI ATASNYA sebelum menyentuh

supabase/migrations/  0001 fondasi · 0003 cache · 0004 penguncian fungsi
                      0005 God Mode (ban, peringatan, kunci API,
                      sakelar penguji, god_stats satu putaran)

.superdesign/         design-system.md = sumber kebenaran visual
```

---

## 9. Aturan merawat file ini

Perbarui HANDOFF.md **di commit yang sama** dengan perubahan yang
membuatnya usang. Yang wajib masuk:
- jebakan baru yang butuh lebih dari 15 menit untuk dilacak
- keputusan produk beserta datanya
- apa yang sudah terbukti jalan, dan dengan cara apa dibuktikannya

Yang tidak perlu: hal yang bisa dibaca dari kode dalam 30 detik.
