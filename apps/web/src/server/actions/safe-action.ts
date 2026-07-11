import { unstable_rethrow } from 'next/navigation'
import 'server-only'
import { getDisplayErrorMessage } from '@/lib/error-utils'
import { logger } from '@/server/observability/logger'
import { getRequestId } from '@/server/observability/request-id'
import { OrchestratorRequestError } from '@/server/orchestrator/request'
import {
  actionError,
  actionOk,
  type ActionError,
  type ActionResult,
  type OperationErrorCode
} from '@/shared/actions/action-result'

const defaultActionFailureMessage = 'The action failed. Try again or check the server logs.'
const orchestratorTransportPrefix = 'Orchestrator request failed:'

const publicActionMessagePatterns = [
  /^App icons must (?:be PNG, JPEG, or WebP image data|not exceed 2 MB)\.$/,
  /^Application not found\.$/,
  /^Avatar must be a PNG, JPEG, or WebP image no larger than 2 MB\.$/,
  /^Cannot remove (?:or disable the last active admin|the last user group)\.$/,
  /^Current password is incorrect\.$/,
  /^Group (?:name is required|not found)\.$/,
  /^Open app limit reached \(\d+\/\d+\)\. Stop an app before starting another\.$/,
  /^Open this app as your own copy before (?:using its live session|starting or controlling its live session)\.$/,
  /^New password must be different from the current password\.$/,
  /^Password change is not required for this account\.$/,
  /^Password must be at least \d+ characters\.$/,
  /^Unsupported accent color\.$/,
  /^User not found\.$/,
  /^Username (?:already exists|is required)(?: and password must be at least \d+ characters)?\.$/,
  /^You do not have permission to [A-Za-z0-9 .-]+\.$/,
  /^[A-Za-z ]+ exceeds your quota of \d+\.$/
]

export class PublicActionError extends Error {
  readonly code?: string
  readonly status?: number

  constructor(
    message: string,
    {
      code,
      status
    }: {
      code?: string
      status?: number
    } = {}
  ) {
    super(message)
    this.name = 'PublicActionError'
    this.code = code
    this.status = status
  }
}

const asErrorRecord = (error: unknown): Record<string, unknown> | null =>
  typeof error === 'object' && error !== null ? (error as Record<string, unknown>) : null

const errorStatus = (error: unknown) => {
  if (error instanceof OrchestratorRequestError) return error.status
  if (error instanceof PublicActionError) return error.status
  const record = asErrorRecord(error)
  return typeof record?.status === 'number' ? record.status : undefined
}

const operationErrorCode = (error: unknown): OperationErrorCode => {
  const status = errorStatus(error)
  if (status === 400 || status === 422) return 'validation'
  if (status === 401) return 'unauthenticated'
  if (status === 403) return 'forbidden'
  if (status === 404) return 'not_found'
  if (status === 409) return 'conflict'
  if (status === 429) return 'rate_limited'
  if (error instanceof OrchestratorRequestError) {
    return status === 502 || status === 503 || status === 504 ? 'upstream_unavailable' : 'upstream_error'
  }
  return 'internal'
}

const isKnownPublicActionMessage = (message: string) =>
  publicActionMessagePatterns.some(pattern => pattern.test(message.trim()))

const safeMessageForActionError = (error: unknown, fallbackMessage: string) => {
  if (error instanceof PublicActionError) {
    return getDisplayErrorMessage(error, fallbackMessage)
  }

  if (error instanceof OrchestratorRequestError) {
    if (error.message.startsWith(orchestratorTransportPrefix)) {
      return 'Could not reach the orchestrator. Check the runtime service and try again.'
    }
    return getDisplayErrorMessage(error, fallbackMessage)
  }

  if (error instanceof Error && isKnownPublicActionMessage(error.message)) {
    return error.message
  }

  return fallbackMessage
}

export const toActionError = (
  error: unknown,
  requestId: string,
  fallbackMessage = defaultActionFailureMessage
): ActionError => {
  const status = errorStatus(error)
  return {
    message: safeMessageForActionError(error, fallbackMessage),
    code: operationErrorCode(error),
    requestId,
    ...(status ? { status } : {})
  }
}

export const runSafeAction = async <T>(
  operation: () => Promise<T> | T,
  {
    fallbackMessage = defaultActionFailureMessage,
    logLabel = 'Server action failed'
  }: {
    fallbackMessage?: string
    logLabel?: string
  } = {}
): Promise<ActionResult<T>> => {
  const requestId = await getRequestId()
  try {
    return actionOk(await operation(), requestId)
  } catch (error) {
    unstable_rethrow(error)
    const safeError = toActionError(error, requestId, fallbackMessage)
    logger.error('server_action.failed', {
      requestId,
      label: logLabel,
      errorName: error instanceof Error ? error.name : 'UnknownError',
      errorMessage: error instanceof Error ? error.message : 'Unknown error'
    })
    return actionError(safeError, requestId)
  }
}
