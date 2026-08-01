import 'server-only'

import { generateStructured } from '@/lib/gemini'
import type { ProspectCandidate } from '@/lib/discovery'

export type PitchTone = 'warm' | 'professional' | 'direct'

/**
 * The single hardest constraint in this file is voice. A generic LLM
 * opener reads as a mail-merge and gets left on read. Every prompt below
 * therefore bans the specific tics that mark a message as machine-written
 * in Indonesian: the "Perkenalkan, saya…" opening, "Semoga pesan ini
 * menemukan Anda dalam keadaan baik", exclamation stacking, and any
 * mention of the sender's own credentials before the reader's problem.
 */
const VOICE_RULES = `
ATURAN SUARA — WAJIB:
- Bahasa Indonesia percakapan sehari-hari. Sapa dengan "Pak"/"Bu"/"Kak" sesuai konteks usaha.
- DILARANG membuka dengan: "Perkenalkan", "Semoga pesan ini menemukan Anda", "Salam sejahtera",
  "Saya harap Anda baik-baik saja", atau menyebut nama pengirim di kalimat pertama.
- DILARANG memakai kata: "solusi terbaik", "revolusioner", "di era digital ini", "sinergi",
  "meningkatkan engagement", "menjangkau lebih luas", "one-stop", "profesional & terpercaya".
- DILARANG memakai emoji lebih dari satu, dan dilarang memakai tanda seru lebih dari satu.
- Kalimat pertama HARUS menyebut sesuatu yang spesifik tentang usaha itu (nama, rating,
  jumlah ulasan, atau lokasinya) supaya jelas ini bukan pesan massal.
- Panjang maksimal 65 kata. Orang baca ini di WhatsApp sambil jualan, bukan di ruang rapat.
- Tutup dengan satu pertanyaan ringan yang gampang dijawab "boleh" atau "coba dong",
  bukan ajakan menelepon atau menjadwalkan meeting.
`.trim()

// ── Lead scoring ────────────────────────────────────────────────────

const SCORE_SCHEMA = {
  type: 'object',
  properties: {
    score: { type: 'integer', minimum: 0, maximum: 100 },
    verdict: { type: 'string' },
    angle: { type: 'string' },
  },
  required: ['score', 'verdict', 'angle'],
} as const

export interface LeadScore {
  score: number
  /** One sentence, shown on the card. Indonesian. */
  verdict: string
  /** The specific weakness to attack in the pitch. */
  angle: string
}

const SCORE_SYSTEM = `
Kamu analis akuisisi klien untuk jasa pembuatan website di Indonesia.
Tugasmu menilai seberapa besar peluang sebuah UMKM mau membeli website.

Cara menilai (skor 0-100):
- Rating tinggi + ulasan banyak = usaha sudah punya pelanggan nyata dan uang masuk. Naikkan skor.
- Ulasan sangat sedikit (< 10) = usaha baru atau sepi. Turunkan skor, uangnya belum ada.
- Sudah punya website = turunkan drastis, mereka bukan target.
- Kategori yang pembelinya mencari lewat internet (kuliner, jasa, kesehatan, otomotif,
  pendidikan) lebih tinggi daripada yang pelanggannya datang dari lalu-lalang saja.
- Rating rendah (< 4.0) dengan ulasan banyak = mereka punya masalah reputasi;
  website justru bisa jadi jalan keluar. Skor menengah, sudutnya beda.

"verdict" = satu kalimat bahasa Indonesia santai yang menjelaskan skornya, maksimal 18 kata.
"angle" = satu kalimat berisi kelemahan paling konkret yang bisa dijual, maksimal 20 kata.
Jangan menyebut angka skor di dalam verdict.
`.trim()

export async function scoreLead(lead: ProspectCandidate): Promise<LeadScore> {
  const result = await generateStructured<LeadScore>({
    system: SCORE_SYSTEM,
    tier: 'fast',
    schema: SCORE_SCHEMA as unknown as Record<string, unknown>,
    temperature: 0.4,
    maxOutputTokens: 400,
    prompt: describeLead(lead),
  })

  return {
    score: Math.max(0, Math.min(100, Math.round(result.score))),
    verdict: result.verdict.trim(),
    angle: result.angle.trim(),
  }
}

// ── Standard pitch ──────────────────────────────────────────────────

const PITCH_SCHEMA = {
  type: 'object',
  properties: { message: { type: 'string' } },
  required: ['message'],
} as const

const TONE_BRIEF: Record<PitchTone, string> = {
  warm: 'Hangat dan akrab, seperti tetangga yang memang sering lewat depan tokonya.',
  professional: 'Sopan dan ringkas, seperti vendor yang sudah biasa menangani klien serius.',
  direct: 'Langsung ke inti dalam dua kalimat. Tanpa basa-basi, tapi tetap tidak kasar.',
}

export async function writePitch(
  lead: ProspectCandidate,
  tone: PitchTone,
  angle?: string | null,
): Promise<string> {
  const { message } = await generateStructured<{ message: string }>({
    system: `Kamu menulis pesan pembuka WhatsApp untuk menawarkan jasa pembuatan website ke UMKM Indonesia.\n\n${VOICE_RULES}\n\nNada yang diminta: ${TONE_BRIEF[tone]}`,
    tier: 'smart',
    schema: PITCH_SCHEMA as unknown as Record<string, unknown>,
    temperature: 1.0,
    maxOutputTokens: 500,
    prompt: [
      describeLead(lead),
      angle ? `\nSudut jualan yang sudah dianalisis: ${angle}` : '',
      '\nTulis satu pesan WhatsApp. Kembalikan hanya isi pesannya, tanpa tanda kutip.',
    ].join(''),
  })

  return message.trim()
}

// ── Deep audit ──────────────────────────────────────────────────────

const AUDIT_SCHEMA = {
  type: 'object',
  properties: {
    weaknesses: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          detail: { type: 'string' },
          impact: { type: 'string', enum: ['tinggi', 'sedang', 'rendah'] },
        },
        required: ['title', 'detail', 'impact'],
      },
      minItems: 2,
      maxItems: 4,
    },
    estimatedLoss: { type: 'string' },
    message: { type: 'string' },
  },
  required: ['weaknesses', 'estimatedLoss', 'message'],
} as const

export interface DeepAudit {
  weaknesses: Array<{ title: string; detail: string; impact: 'tinggi' | 'sedang' | 'rendah' }>
  /** Plain-language revenue estimate, hedged honestly. */
  estimatedLoss: string
  message: string
}

const AUDIT_SYSTEM = `
Kamu konsultan digital yang membedah kelemahan kehadiran online sebuah UMKM Indonesia.

Untuk setiap kelemahan: sebutkan apa yang hilang secara konkret, bukan istilah teknis.
Contoh baik: "Calon pelanggan yang cari di Google cuma nemu pin Maps, jadi mereka nggak
tahu harga dan langsung pindah ke pesaing." Contoh buruk: "Kurangnya optimasi SEO."

"estimatedLoss" harus jujur bahwa ini perkiraan kasar, dan disebut dalam rupiah per bulan
dengan rentang, bukan angka tunggal yang sok pasti.

"message" adalah pesan WhatsApp yang memakai temuan di atas sebagai amunisi.
${VOICE_RULES}
Khusus untuk pesan audit ini, panjang maksimal 90 kata dan boleh menyebut satu angka temuan.
`.trim()

export async function deepAudit(lead: ProspectCandidate): Promise<DeepAudit> {
  return generateStructured<DeepAudit>({
    system: AUDIT_SYSTEM,
    tier: 'smart',
    schema: AUDIT_SCHEMA as unknown as Record<string, unknown>,
    temperature: 0.9,
    maxOutputTokens: 1_400,
    thinking: true,
    timeoutMs: 20_000,
    prompt: describeLead(lead),
  })
}

// ── Shared ──────────────────────────────────────────────────────────

function describeLead(lead: ProspectCandidate): string {
  return [
    `Nama usaha: ${lead.name}`,
    `Kategori: ${lead.category ?? 'tidak diketahui'}`,
    `Alamat: ${lead.address ?? 'tidak diketahui'}`,
    `Daerah: ${lead.area ?? 'tidak diketahui'}`,
    `Rating Google: ${lead.rating ?? 'belum ada'}`,
    `Jumlah ulasan: ${lead.reviewCount}`,
    `Website: ${lead.website ?? 'TIDAK PUNYA'}`,
    `Nomor telepon terdaftar: ${lead.phone ? 'ada' : 'tidak ada'}`,
  ].join('\n')
}
