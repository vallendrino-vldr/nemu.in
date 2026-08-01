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

### 6.0 God Mode: pisahkan halaman & beri kekuatan penuh (BESAR)
Pemilik ingin: masuk seperti pengguna biasa, lalu satu ikon admin membuka
**halaman terpisah** dengan kekuatan penuh. Saat ini God Mode adalah tab
biasa yang isinya minim.

Yang diminta: hapus akun user, ban, kirim peringatan, tambah/ganti API
key Gemini dari UI, dan saldo admin yang terlihat serta bisa
ditambah/dikurangi sendiri (pemilik memakai akunnya sendiri sebagai
penguji, jadi dia perlu melihat kredit benar-benar berkurang).

Catatan performa: membuka tab God bisa makan 7 detik karena
`loadGodStats` menjalankan empat agregat sekaligus. Pindahkan ke satu
RPC Postgres, atau muat bertahap.

Catatan desain: kredit admin sekarang tampil `∞` dan tidak pernah
berkurang (`consume_credits` mem-bypass super_admin). Untuk mode
penguji, tambahkan sakelar "tagih saya seperti user biasa".

### 6.1 Rombak visual dashboard (PALING MENDESAK)
Penilaian pemilik, kata-katanya sendiri: *"berantakan, murahan, ga
berkelas, ga fresh, ga profesional, terlalu generik, AI SLOP, warnanya
ga menarik"* — dan dia **tidak pede mempublikasikannya**.

Ini penilaian yang sah. Tab Berburu saat ini hanyalah tumpukan kolom
input di atas satu panel abu-abu besar. Tidak ada hierarki, tidak ada
momen, tidak ada kepribadian.

Arah yang disarankan (pakai skill `ui-ux-pro-max` dan `superdesign`,
jangan mendesain dari asumsi):
- Beri dashboard sebuah **layar pembuka yang hidup** — bukan formulir.
  Angka besar: berapa lead siap-WA yang menunggu, berapa yang belum
  disentuh hari ini.
- Sapuan harus terasa seperti **satu tindakan besar**, bukan tiga kolom.
  Pertimbangkan satu kolom pencarian ala Spotlight + saran cepat
  ("kedai kopi di Jogja", "bengkel di Bekasi").
- Palet ember/obsidian sekarang terlalu rata di mode gelap. Butuh satu
  warna aksen kedua dan permukaan yang lebih bertingkat.
- Kartu lead adalah produk sesungguhnya — beri dia kelas, bukan panel.

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
├── components/
│   ├── app-shell.tsx    shell native, tab client-side
│   ├── safe-widget.tsx  blast door untuk komponen dekoratif
│   └── views/           satu file per tab
└── store/lead-store.ts  BACA CATATAN DI ATASNYA sebelum menyentuh

supabase/migrations/  0001 fondasi · 0003 cache · 0004 penguncian fungsi
```

---

## 9. Aturan merawat file ini

Perbarui HANDOFF.md **di commit yang sama** dengan perubahan yang
membuatnya usang. Yang wajib masuk:
- jebakan baru yang butuh lebih dari 15 menit untuk dilacak
- keputusan produk beserta datanya
- apa yang sudah terbukti jalan, dan dengan cara apa dibuktikannya

Yang tidak perlu: hal yang bisa dibaca dari kode dalam 30 detik.
