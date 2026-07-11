import { unstable_rethrow } from 'next/navigation'
import 'server-only'
import { PublicActionError } from '@/server/errors/public-action-error'
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

const asErrorRecord = (error: unknown): Record<string, unknown> | null =>
  typeof error === 'object' && error !== null ? (error as Record<string, unknown>) : null

const errorStatus = (error: unknown) => {
  if (error instanceof OrchestratorRequestError) return error.status
  if (error instanceof PublicActionError) return error.status
  const record = asErrorRecord(error)
  return typeof record?.status === 'number' ? record.status : undefined
}

const operationErrorCode = (error: unknown): OperationErrorCode => {
  if (error instanceof PublicActionError) return error.code
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

const safeMessageForActionError = (error: unknown, fallbackMessage: string) => {
  if (error instanceof PublicActionError) {
    return error.message
  }

  if (error instanceof OrchestratorRequestError) {
    if (
      error.message.startsWith(orchestratorTransportPrefix) ||
      error.status === 502 ||
      error.status === 503 ||
      error.status === 504
    ) {
      return 'Could not reach the orchestrator. Check the runtime service and try again.'
    }
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
    ...(status ? { status } : {}),
    ...(error instanceof PublicActionError && error.fieldErrors ? { fieldErrors: error.fieldErrors } : {})
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
      errorCode: safeError.code,
      errorStatus: safeError.status
    })
    return actionError(safeError, requestId)
  }
}
