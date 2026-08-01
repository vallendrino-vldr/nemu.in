/**
 * Every server action returns one of these instead of throwing across the
 * network boundary. The UI switches on `code` to pick a designed error
 * state — the user never sees a stack trace or the string "500".
 */
export type FailureCode =
  | 'auth'
  | 'insufficient_credits'
  | 'api_disabled'
  | 'quota'
  | 'ai_busy'
  | 'empty'
  | 'not_found'
  | 'forbidden'
  | 'unknown'

export interface Failure {
  ok: false
  code: FailureCode
  /** Populated for insufficient_credits so the UI can say the real numbers. */
  needed?: number
  have?: number
  /** Populated for `empty` so the Smart Radius Expansion prompt knows its target. */
  suggestRadius?: number
}

export type ActionResult<T> = { ok: true; data: T } | Failure

export const fail = (code: FailureCode, extra: Omit<Failure, 'ok' | 'code'> = {}): Failure => ({
  ok: false,
  code,
  ...extra,
})

export const succeed = <T>(data: T): ActionResult<T> => ({ ok: true, data })
