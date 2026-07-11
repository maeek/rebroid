export type OperationErrorCode =
  | 'validation'
  | 'unauthenticated'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'rate_limited'
  | 'upstream_unavailable'
  | 'upstream_error'
  | 'internal'

export interface ActionError {
  message: string
  code: OperationErrorCode
  requestId: string
  status?: number
  fieldErrors?: Record<string, string[]>
}

export type ActionSuccess<T = void> = { ok: true; data: T; requestId: string }
export type ActionFailure = { ok: false; error: ActionError; requestId: string }
export type ActionResult<T = void> = ActionSuccess<T> | ActionFailure

const localRequestId = 'local'

export const actionOk = <T>(data: T, requestId = localRequestId): ActionResult<T> => ({ ok: true, data, requestId })

export const actionError = (
  error: Omit<ActionError, 'code' | 'requestId'> & Partial<Pick<ActionError, 'code' | 'requestId'>>,
  requestId = error.requestId ?? localRequestId
): ActionResult<never> => ({
  ok: false,
  requestId,
  error: {
    ...error,
    code: error.code ?? 'internal',
    requestId
  }
})

export class ActionResultError extends Error {
  constructor(readonly failure: ActionError) {
    super(failure.message)
    this.name = 'ActionResultError'
  }
}

export const isActionResult = <T = unknown>(value: unknown): value is ActionResult<T> => {
  if (!value || typeof value !== 'object' || !('ok' in value)) return false
  const candidate = value as { ok: unknown; data?: unknown; error?: unknown; requestId?: unknown }
  if (typeof candidate.requestId !== 'string') return false
  if (candidate.ok === true) return 'data' in candidate
  if (candidate.ok !== false || !candidate.error || typeof candidate.error !== 'object') return false
  const error = candidate.error as Partial<ActionError>
  return (
    typeof error.message === 'string' &&
    typeof error.code === 'string' &&
    typeof error.requestId === 'string' &&
    error.requestId === candidate.requestId
  )
}

export const isActionFailure = (value: unknown): value is ActionFailure => isActionResult(value) && !value.ok

export const unwrapActionResult = <T>(result: ActionResult<T>): T => {
  if (result.ok) return result.data
  throw new ActionResultError(result.error)
}

export const actionResultErrorMessage = (result: ActionResult<unknown>, fallback = 'The action failed.') =>
  result.ok ? null : result.error.message || fallback
