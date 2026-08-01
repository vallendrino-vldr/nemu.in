import 'server-only'

/**
 * Gemini dual-key load balancer.
 *
 * Free-tier rate limits are enforced per API key, so two keys on two
 * Google accounts genuinely double the ceiling. This module round-robins
 * between them and, when a key returns 429, puts that key in a cooldown
 * so the next request does not immediately walk into the same wall.
 *
 * State lives in module scope, which means it is per warm lambda
 * instance. That is intentional: a shared cooldown store would need Redis,
 * and the budget for Redis is zero. Worst case a cold instance retries a
 * throttled key once and fails over — one wasted round trip, no crash.
 *
 * TWO QUIRKS FOUND BY ACTUALLY CALLING THE API
 * ────────────────────────────────────────────
 *  1. `thinkingConfig` is not universal. `gemini-3.5-flash` needs it (or
 *     it spends the entire output budget thinking and returns truncated
 *     JSON with finishReason MAX_TOKENS), while `gemini-3.5-flash-lite`
 *     rejects it outright with 400 INVALID_ARGUMENT. Rather than hardcode
 *     a model-name heuristic that rots on the next release, a 400 triggers
 *     one automatic retry without the field, and the result is remembered
 *     per model for the life of the instance.
 *  2. Some models prepend prose or wrap the payload in a markdown fence
 *     even when responseMimeType is application/json. The extractor below
 *     handles that instead of letting JSON.parse throw.
 */

const ENDPOINT_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'
const COOLDOWN_MS = 45_000
/** How long a warm instance trusts its copy of the key list. */
const KEY_CACHE_MS = 60_000

interface KeySlot {
  key: string
  label: string
  cooldownUntil: number
  /** Set for keys that came from the database, so usage can be recorded. */
  rowId?: string
}

let slots: KeySlot[] | null = null
let slotsLoadedAt = 0
let cursor = 0

/** Models known to reject `thinkingConfig`. Learned at runtime, not guessed. */
const thinkingUnsupported = new Set<string>()

function envSlots(): KeySlot[] {
  // Every GEMINI_API_KEY_* variable joins the rotation. Free-tier limits
  // are per key, so each one added is another whole quota.
  const configured: Array<[string, string | undefined]> = [
    ['primary', process.env.GEMINI_API_KEY_PRIMARY],
    ['secondary', process.env.GEMINI_API_KEY_SECONDARY],
    ['tertiary', process.env.GEMINI_API_KEY_TERTIARY],
    ['quaternary', process.env.GEMINI_API_KEY_QUATERNARY],
  ]
  return configured
    .filter((entry): entry is [string, string] => Boolean(entry[1]))
    .map(([label, key]) => ({ key, label, cooldownUntil: 0 }))
}

/**
 * The rotation: keys added from God Mode, plus anything still in the
 * environment.
 *
 * Env keys used to be the only source, which meant rotating one required
 * a redeploy. Database keys now come first and env keys stay as a
 * fallback, so an empty `api_keys` table changes nothing about how the
 * app behaves — the owner can migrate one key at a time instead of all
 * at once.
 *
 * The list is cached per warm instance for a minute. A key switched off
 * in the console therefore stops being used within about a minute rather
 * than instantly, which is the right trade against a database round trip
 * on every single AI call. The kill switch, which IS instant, is the
 * control for "stop everything now".
 *
 * Any failure to reach the database falls through to the env keys. An
 * admin table being briefly unreachable must never take AI down.
 */
async function getSlots(): Promise<KeySlot[]> {
  const now = Date.now()
  if (slots && now - slotsLoadedAt < KEY_CACHE_MS) return slots

  const fromEnv = envSlots()

  try {
    const { getAdminClient } = await import('@/lib/supabase/admin')
    const { data } = await getAdminClient()
      .from('api_keys')
      .select('id, label, secret')
      .eq('provider', 'gemini')
      .eq('active', true)
      .order('created_at', { ascending: true })

    const fromDb: KeySlot[] = (data ?? []).map((row) => ({
      key: row.secret,
      label: row.label,
      cooldownUntil: 0,
      rowId: row.id,
    }))

    // A key present in both places is one key, not two attempts at the
    // same exhausted quota.
    const seen = new Set(fromDb.map((slot) => slot.key))
    slots = [...fromDb, ...fromEnv.filter((slot) => !seen.has(slot.key))]
  } catch (error) {
    console.warn('[gemini] key table unreachable, using env only:', (error as Error)?.message)
    slots = fromEnv
  }

  slotsLoadedAt = now
  cursor = 0
  return slots
}

/** Records the outcome against a database-backed key. Never blocks. */
function noteKeyOutcome(slot: KeySlot, error: string | null): void {
  if (!slot.rowId) return
  void (async () => {
    try {
      const { getAdminClient } = await import('@/lib/supabase/admin')
      await getAdminClient().rpc('mark_api_key', { p_id: slot.rowId!, p_error: error })
    } catch {
      /* telemetry, not a dependency */
    }
  })()
}

/** Drops the cache so the next call re-reads the table immediately. */
export function invalidateGeminiKeys(): void {
  slots = null
  slotsLoadedAt = 0
}

export class GeminiError extends Error {
  constructor(
    message: string,
    readonly kind: 'exhausted' | 'auth' | 'malformed' | 'network' | 'disabled',
  ) {
    super(message)
    this.name = 'GeminiError'
  }
}

export type GeminiTier = 'fast' | 'smart'

function modelFor(tier: GeminiTier): string {
  return tier === 'fast'
    ? (process.env.GEMINI_MODEL_FAST ?? 'gemini-3.5-flash-lite')
    : (process.env.GEMINI_MODEL_SMART ?? 'gemini-3.5-flash')
}

interface GenerateInput {
  system: string
  prompt: string
  tier?: GeminiTier
  /** OpenAPI-subset schema. Forces valid JSON out instead of hoping for it. */
  schema: Record<string, unknown>
  temperature?: number
  maxOutputTokens?: number
  /** Let the model reason before answering. Costs tokens and latency. */
  thinking?: boolean
  timeoutMs?: number
}

export async function generateStructured<T>({
  system,
  prompt,
  tier = 'fast',
  schema,
  temperature = 0.8,
  maxOutputTokens = 1_024,
  thinking = false,
  timeoutMs = 15_000,
}: GenerateInput): Promise<T> {
  const pool = await getSlots()
  if (pool.length === 0) throw new GeminiError('No Gemini keys configured', 'auth')

  const model = modelFor(tier)

  const buildBody = (withThinkingConfig: boolean) => ({
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature,
      maxOutputTokens,
      responseMimeType: 'application/json',
      responseSchema: schema,
      ...(withThinkingConfig ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
    },
    safetySettings: [
      'HARM_CATEGORY_HARASSMENT',
      'HARM_CATEGORY_HATE_SPEECH',
      'HARM_CATEGORY_SEXUALLY_EXPLICIT',
      'HARM_CATEGORY_DANGEROUS_CONTENT',
    ].map((category) => ({ category, threshold: 'BLOCK_ONLY_HIGH' })),
  })

  const now = Date.now()
  // Start from the round-robin cursor, then walk the whole pool once,
  // pushing any key still cooling down to the back.
  const order = pool
    .map((_, offset) => pool[(cursor + offset) % pool.length]!)
    .sort((a, b) => Number(a.cooldownUntil > now) - Number(b.cooldownUntil > now))

  cursor = (cursor + 1) % pool.length

  let lastKind: GeminiError['kind'] = 'network'

  for (const slot of order) {
    // Suppress thinking unless asked for it, except on models that refuse
    // the parameter entirely.
    let sendThinkingConfig = !thinking && !thinkingUnsupported.has(model)

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await fetch(`${ENDPOINT_BASE}/${model}:generateContent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': slot.key },
          body: JSON.stringify(buildBody(sendThinkingConfig)),
          signal: AbortSignal.timeout(timeoutMs),
          cache: 'no-store',
        })

        if (response.status === 429 || response.status === 503) {
          slot.cooldownUntil = Date.now() + COOLDOWN_MS
          lastKind = 'exhausted'
          noteKeyOutcome(slot, `Kuota penuh (${response.status})`)
          break // next key, not next attempt
        }

        if (response.status === 400 && sendThinkingConfig) {
          // Almost certainly the thinkingConfig rejection. Remember it for
          // this model and retry once clean.
          thinkingUnsupported.add(model)
          sendThinkingConfig = false
          continue
        }

        if (response.status === 401 || response.status === 403 || response.status === 400) {
          lastKind = 'auth'
          noteKeyOutcome(slot, `Kunci ditolak Google (${response.status})`)
          break
        }
        if (!response.ok) {
          lastKind = 'network'
          break
        }

        const payload = (await response.json()) as {
          candidates?: Array<{
            finishReason?: string
            content?: { parts?: Array<{ text?: string }> }
          }>
        }

        const candidate = payload.candidates?.[0]
        const text = candidate?.content?.parts?.[0]?.text
        if (!text) {
          lastKind = 'malformed'
          break
        }

        const parsed = extractJson<T>(text)
        if (parsed === null) {
          // Truncated mid-object is the classic MAX_TOKENS symptom.
          lastKind = 'malformed'
          break
        }

        slot.cooldownUntil = 0
        noteKeyOutcome(slot, null)
        return parsed
      } catch {
        lastKind = 'network'
        break
      }
    }
  }

  throw new GeminiError(`All ${pool.length} Gemini route(s) failed`, lastKind)
}

/**
 * Pulls a JSON object out of a model response.
 *
 * Handles three shapes seen in the wild: clean JSON, a ```json fenced
 * block, and prose followed by an object. Returns null rather than
 * throwing so the caller can fail over to the other key.
 */
function extractJson<T>(raw: string): T | null {
  const attempt = (candidate: string): T | null => {
    try {
      return JSON.parse(candidate) as T
    } catch {
      return null
    }
  }

  const direct = attempt(raw.trim())
  if (direct !== null) return direct

  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(raw)
  if (fenced?.[1]) {
    const inner = attempt(fenced[1].trim())
    if (inner !== null) return inner
  }

  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start !== -1 && end > start) {
    const sliced = attempt(raw.slice(start, end + 1))
    if (sliced !== null) return sliced
  }

  return null
}
