import 'server-only'
import { toActionError } from '@/server/actions/safe-action'
import { logger } from '@/server/observability/logger'
import { getRequestId } from '@/server/observability/request-id'
import { actionError, actionOk } from '@/shared/actions/action-result'

export const runRouteHandler = async <T>(operation: () => Promise<T> | T) => {
  const requestId = await getRequestId()
  try {
    return Response.json(actionOk(await operation(), requestId), {
      headers: { 'x-request-id': requestId }
    })
  } catch (error) {
    const publicError = toActionError(error, requestId)
    logger.error('route_handler.failed', {
      requestId,
      errorName: error instanceof Error ? error.name : 'UnknownError',
      errorMessage: error instanceof Error ? error.message : 'Unknown error'
    })
    return Response.json(actionError(publicError, requestId), {
      status: publicError.status ?? 500,
      headers: { 'x-request-id': requestId }
    })
  }
}
