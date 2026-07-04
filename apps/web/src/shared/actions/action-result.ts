export interface ActionError {
  message: string
  code?: string
  status?: number
}

export type ActionSuccess<T = void> = { ok: true; data: T }
export type ActionFailure = { ok: false; error: ActionError }
export type ActionResult<T = void> = ActionSuccess<T> | ActionFailure

export const actionOk = <T>(data: T): ActionResult<T> => ({ ok: true, data })

export const actionError = (error: ActionError): ActionResult<never> => ({ ok: false, error })

export class ActionResultError extends Error {
  constructor(readonly actionError: ActionError) {
    super(actionError.message)
    this.name = 'ActionResultError'
  }
}

export const isActionResult = <T = unknown>(value: unknown): value is ActionResult<T> => {
  if (!value || typeof value !== 'object' || !('ok' in value)) return false
  const candidate = value as { ok: unknown; data?: unknown; error?: unknown }
  if (candidate.ok === true) return 'data' in candidate
  if (candidate.ok !== false || !candidate.error || typeof candidate.error !== 'object') return false
  return 'message' in candidate.error && typeof (candidate.error as { message?: unknown }).message === 'string'
}

export const isActionFailure = (value: unknown): value is ActionFailure => isActionResult(value) && !value.ok

export const unwrapActionResult = <T>(result: ActionResult<T>): T => {
  if (result.ok) return result.data
  throw new ActionResultError(result.error)
}

export const actionResultErrorMessage = (result: ActionResult<unknown>, fallback = 'The action failed.') =>
  result.ok ? null : result.error.message || fallback
