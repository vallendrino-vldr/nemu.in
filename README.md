# Nemu.in

**Mesin Pencari Klien, Bukan Alasan.**

Nyisir Google Maps untuk menemukan UMKM Indonesia yang belum punya website, menilai
potensinya dengan AI, lalu menyiapkan pesan pembuka WhatsApp yang menyebut nama toko
mereka — bukan template massal.

Baca **[SETUP.md](SETUP.md)** untuk menyalakannya. Dokumen ini menjelaskan cara kerjanya.

---

## Cara kerja, dari klik sampai pesan terkirim

1. **Sisir** — satu permintaan ke Google Places mengembalikan nama, alamat, rating,
   dan **nomor telepon** sekaligus.
2. **Saring** — hanya usaha yang nomornya aktif *dan* kolom website-nya kosong yang
   ditampilkan. Sisanya bukan calon pembeli.
3. **Nilai** — Gemini memberi skor 1–100 dan menunjuk satu kelemahan paling konkret
   untuk dijadikan bahan jualan.
4. **Tulis** — pesan WhatsApp disusun dari kelemahan tadi, dibatasi 65 kata.
5. **Kirim** — aplikasi hanya membuka `wa.me` dengan pesan sudah terisi. **Kamu** yang
   menekan tombol kirim, dari nomormu sendiri. Tidak ada bot, tidak ada risiko banned.

---

## Tiga keputusan yang menentukan biayanya tetap nol

### Satu panggilan, bukan dua

Cara paling umum menulis fitur ini adalah: cari daftar usaha, lalu panggil Place Details
satu per satu untuk mengambil nomor telepon. Itu berarti **1 + N** panggilan per
pencarian — jatah gratis Google habis berkali-kali lipat lebih cepat.

Places API (New) sebenarnya bisa mengembalikan nomor telepon langsung dari pencarian,
asal field-nya diminta lewat `X-Goog-FieldMask`. Satu panggilan, sepuluh hasil, nomor
ikut terbawa. Field mask itu ada di [`src/lib/places.ts`](src/lib/places.ts) — jangan
"dirapikan" dengan membuang field, karena itu justru yang menahan biayanya.

### Arsip bersama

Setiap hasil pencarian disimpan di `place_cache` dan `search_cache`. Kalau ada orang lain
mencari "kedai kopi di Jogja" minggu ini, hasilnya diambil dari arsip: **nol panggilan
Google, nol kredit terpotong.** Pengguna diberi tahu lewat label kecil bahwa hasilnya
dari arsip.

### Lokasi dari browser, bukan dari Google

Radius pencarian butuh koordinat. Menerjemahkan nama kota jadi koordinat lewat Google
adalah panggilan berbayar tambahan. Aplikasi ini memakai GPS browser — gratis, akurat,
dan pengguna yang memberi izin sendiri.

---

## Kredit

| Aksi | Biaya |
|---|---|
| Sisir Google Maps (10 lead) | 2 |
| Pesan pembuka WhatsApp | 1 |
| Skor potensi AI | 3 |
| Tanya Kopilot | 2 |
| Audit mendalam | 8 |
| **Website Hantu** | **0** |
| Akun baru | **+30** |

Aturan yang dipegang di seluruh aplikasi: **pencarian yang gagal atau kosong tidak
pernah menghabiskan kredit.** Setiap panggilan AI yang error otomatis mengembalikan
kredit lewat `refund_credits`. Itu sebabnya tombol "lebarin radius" aman ditekan.

Potongan kredit terjadi di dalam satu fungsi Postgres dengan penguncian baris
([`consume_credits`](supabase/migrations/0001_foundation.sql)) — dua tab yang menekan
tombol bersamaan tidak bisa sama-sama lolos pengecekan saldo.

---

## Website Hantu 👻

Fitur yang paling sering menutup penjualan, dan biayanya nol.

Begitu sebuah lead muncul, aplikasi langsung merakit **contoh website milik usaha itu**
dari data yang sudah ada di tangan: nama, kategori, rating, jumlah ulasan, daerah.
Tidak ada panggilan AI, tidak ada pengambilan gambar, tidak ada permintaan tambahan ke
Google. Warnanya pun diturunkan secara pasti dari nama usaha, jadi selalu sama di
perangkat mana pun.

Tombol **Simpan gambar** menggambar ulang halaman itu ke kanvas 1080×1350 — rasio potret
yang ditampilkan WhatsApp tanpa terpotong — lalu mengunduhnya sebagai PNG.

Kirim gambarnya, lalu tulis: *"Pak, gini kalau toko Bapak punya website."*

---

## God Mode

Muncul hanya untuk akun ber-`role = 'super_admin'`. Pengguna biasa yang membuka `/god`
mendapat **404**, bukan 403 — mengonfirmasi bahwa halaman itu ada pun sudah terlalu
banyak bocor.

- **Suntik kredit** — saldo di layar pengguna berubah saat itu juga lewat Supabase
  Realtime, tanpa mereka refresh.
- **Rem darurat API** — dua sakelar fisik untuk menghentikan seluruh panggilan Places
  atau Gemini secara global. Dipakai kalau kuota Google mulai kritis.
- Super admin tidak dipotong kredit, tapi pemakaiannya **tetap dicatat di buku besar**
  supaya bisa diaudit, bukan tak terlihat.

---

## Peta file

```
src/
├── actions/          Server Actions — semua jalur berbayar lewat sini
│   ├── hunt.ts       Sisir: rem darurat → cache → potong → panggil → refund
│   ├── enrich.ts     Skor AI, pesan pembuka, audit mendalam
│   └── admin.ts      God Mode
├── lib/
│   ├── places.ts     Google Places + field mask penghemat kuota
│   ├── gemini.ts     Penyeimbang dua kunci AI + masa jeda saat kena limit
│   ├── credits.ts    Penjaga kredit & rem darurat
│   ├── ai/analyst.ts Prompt AI + aturan larangan bahasa robot
│   └── ghost-canvas.ts  Website Hantu → PNG, tanpa library tambahan
├── components/       UI skeuomorfik, nol file gambar
└── app/[locale]/     Halaman (Indonesia & Inggris)

supabase/migrations/  Struktur database, RLS, dan fungsi kredit
```

---

## Catatan desain

Tidak ada satu pun file gambar di aplikasi ini. Tekstur butiran, kilau logam, dan bayangan
timbul semuanya CSS. Bayangan ditulis sebagai **keadaan fisik** (`relief`, `pressed`,
`well`) — bukan ukuran — karena benda nyata hanya bisa menangkap cahaya, terdorong masuk,
atau tercekung, dan rasio sorot/bayangnya harus terbalik antara mode terang dan gelap.
Detailnya ada di [`src/app/globals.css`](src/app/globals.css) dan
[`tailwind.config.ts`](tailwind.config.ts).

Aturan penulisan pesan AI dikunci di
[`src/lib/ai/analyst.ts`](src/lib/ai/analyst.ts): dilarang membuka dengan "Perkenalkan",
dilarang memakai "solusi terbaik" atau "di era digital ini", maksimal satu emoji, dan
kalimat pertama **wajib** menyebut sesuatu yang spesifik tentang usaha itu — supaya
jelas ini bukan pesan sebar.
