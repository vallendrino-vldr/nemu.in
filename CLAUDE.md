# Nemu.in — aturan proyek

**Sebelum melakukan apa pun, baca [HANDOFF.md](HANDOFF.md).** File itu
berisi status terkini, empat jebakan yang mahal untuk ditemukan ulang,
dan apa yang sudah terbukti jalan. Membacanya lebih murah daripada
mengaudit ulang, dan mencegah mengulang bug yang sudah dibayar mahal.

## Komunikasi

Pemilik awam total soal coding. Bahasa Indonesia santai ("lo/gue"),
langsung ke inti. Jelaskan lewat dampak ke aplikasi, bukan nama fungsi:
"saldo kepotong otomatis", bukan "menambahkan trigger AFTER INSERT".

Jangan pernah menyatakan sesuatu beres tanpa bukti dari tes nyata. Kalau
belum diuji, katakan belum diuji.

## Empat aturan teknis yang tidak boleh dilanggar

1. **Selector Zustand tidak boleh mengembalikan array baru.** Zustand v5
   akan looping sampai crash. Turunkan dengan `useMemo` di komponen.
   Detail di HANDOFF §4.1.
2. **`revoke ... from public` dulu**, baru grant. Mencabut dari `anon`
   saja tidak melakukan apa pun. HANDOFF §4.3.
3. **`auth` wajib dikecualikan dari matcher middleware**, atau OAuth
   callback jadi 404. HANDOFF §4.4.
4. **Apa pun yang dekoratif dibungkus `SafeWidget`**, dan setiap
   langganan realtime harus gagal-lunak. Browser keras memblokir WebGL
   dan WebSocket pihak ketiga. HANDOFF §4.5.

## Cara mendiagnosis

Ukur sistem yang hidup, jangan menebak dari kode. Log runtime Vercel dan
log auth Supabase menjawab "server atau browser?" dalam hitungan detik.
Server Action bisa dipanggil lewat HTTP dengan header `Next-Action`.
HANDOFF §7.

## Rahasia

`.env.local` dan `VERCEL-ENV-IMPORT.txt` berisi kredensial asli dan
di-gitignore. Jangan pernah menulis nilai rahasia ke file yang bisa
ter-push, dan selalu audit staged diff sebelum commit.

Agen tidak boleh mengetik API secret atau password ke form pihak ketiga —
itu pekerjaan pemilik.
