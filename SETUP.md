# Menyalakan Nemu.in

**Sebagian besar sudah dikerjakan.** Database, keamanan, kunci API, dan
kredensial sudah terpasang dan sudah diuji. Yang tersisa cuma dua hal yang
memang harus kamu klik sendiri.

---

## Sudah beres (tidak perlu kamu sentuh)

| | |
|---|---|
| Database Supabase | 6 tabel, 10 fungsi, aturan keamanan terpasang & diuji |
| Mesin pencari usaha | Geoapify + OpenStreetMap, **tanpa kartu kredit** |
| Otak AI | Dua kunci Gemini, sudah dites, model `3.5-flash` & `3.5-flash-lite` |
| Kunci & kata sandi | Tersimpan di `.env.local` (tidak ikut ter-upload) |
| Akun Super Admin | `vallendrino@gmail.com` otomatis jadi God Mode saat login pertama |

---

## Sisa 2 langkah

### Langkah 1 — Nyalakan tombol "Masuk pakai Google"

Kunci Google-nya sudah ada, tapi harus ditempel ke Supabase sekali.

1. Buka **supabase.com** → project **nemu.in** → menu kiri **Authentication**
   → **Sign In / Providers**.
2. Cari **Google**, nyalakan tombolnya.
3. Isi dua kolom **Client ID** dan **Client Secret**. Keduanya ada di catatan
   pribadimu (`nemu.in penting.txt`), di bagian *OAuth client Google cloud
   console*. Salin apa adanya.
4. Klik **Save**.

> Alamat callback-nya sudah cocok dari sananya, jadi tidak ada yang perlu
> disesuaikan di Google Cloud Console.

### Langkah 2 — Jalankan

Buka terminal di folder ini:

```bash
npm run dev
```

Lalu buka **http://localhost:3000** dan klik **Masuk pakai Google**.

Begitu masuk, ikon perisai muncul di pojok kanan atas — itu God Mode, dan
kamu otomatis sudah jadi pemiliknya.

---

## Kalau mau naik ke internet (Vercel)

1. **vercel.com** → login pakai Google → **Add New Project** → pilih repo
   `nemu.in`.
2. Bagian **Environment Variables**: buka file `.env.local` di folder ini,
   salin seluruh isinya, tempel ke sana.
3. Ubah satu baris: `NEXT_PUBLIC_SITE_URL` jadi alamat Vercel-mu
   (misal `https://nemu-in.vercel.app`).
4. Deploy.
5. **Jangan lewatkan yang ini:** balik ke Supabase → **Authentication** →
   **URL Configuration** → masukkan alamat Vercel tadi ke **Site URL** dan
   **Redirect URLs**. Kalau dilewat, tombol login akan mental balik ke
   localhost dan gagal.

---

## Biaya bulanan

| Bagian | Biaya |
|---|---|
| Supabase (database + login) | Rp 0 |
| Vercel (hosting) | Rp 0 |
| Gemini AI (2 kunci) | Rp 0 |
| Geoapify (3.000 pencarian/hari) | Rp 0 |
| OpenStreetMap | Rp 0, tanpa kunci |

**Tanpa kartu kredit sama sekali.** Itu sebabnya Google Places tidak dipakai —
dia baru mau jalan kalau ada kartu terpasang. Kalau suatu hari kamu punya
kartu dan mau data yang lebih kaya, cukup isi `GOOGLE_PLACES_API_KEY` di
`.env.local`; aplikasinya otomatis pindah, tanpa ada kode yang perlu diubah.

---

## Yang perlu kamu tahu soal hasil pencarian

Ini fakta dari pengujian asli di Yogyakarta, radius 5 km, kategori kuliner:

- **306 usaha** ketemu, **295 di antaranya belum punya website** — ini harta
  karunnya, dan datanya sangat lengkap.
- Tapi **cuma 4 yang nomor HP-nya terdaftar** dan bisa langsung di-WhatsApp.
  11 lagi punya telepon rumah.

Peta terbuka di Indonesia memang jarang mencantumkan nomor HP. Jadi aplikasi
ini **tidak membuang** ratusan usaha lain hanya karena nomornya kosong.
Semuanya ditampilkan, diurutkan dari yang paling gampang dihubungi:

1. 🟢 **Siap di-WA** — satu klik langsung buka WhatsApp
2. 🟡 **Telepon saja** — tombolnya berubah jadi panggilan telepon
3. ⚪ **Datangi / cari IG-nya** — lokasinya ada di Maps

Kartu **Website Hantu** bekerja untuk ketiganya, karena tidak butuh nomor
sama sekali.

---

## Kalau ada yang macet

**Tombol login mental balik**
Langkah 1 belum selesai, atau Site URL di Supabase belum diisi (kalau sudah
di Vercel).

**Pencarian kosong terus**
Coba kata yang lebih umum ("makan" daripada "warung tenda seblak"), atau
tekan tombol **Lebarin radius** yang muncul. Pencarian kosong tidak pernah
memotong kredit.

**"Kredit kurang"**
Buka God Mode (ikon perisai), cari akunmu, klik **+200**. Saldonya berubah
saat itu juga.

**AI bilang lagi antre panjang**
Dua kunci Gemini sedang kena batas harian. Tunggu sebentar. Kreditmu tidak
terpotong — sistem otomatis mengembalikannya setiap panggilan AI gagal.
