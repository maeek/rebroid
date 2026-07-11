import type { Instrumentation } from 'next'

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const { logger } = await import('@/server/observability/logger')
  const requestError = error instanceof Error ? error : new Error('Unknown request error')
  logger.error('next.request_error', {
    requestId: request.headers['x-request-id'],
    method: request.method,
    path: request.path,
    routePath: context.routePath,
    routeType: context.routeType,
    errorName: requestError.name,
    errorDigest: 'digest' in requestError ? requestError.digest : undefined
  })
}
