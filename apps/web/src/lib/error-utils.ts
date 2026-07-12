import { ActionResultError } from '@/shared/actions/action-result'

export function getDisplayErrorMessage(
  error: unknown,
  fallback = 'The server did not return details for this failure.'
): string {
  const requestId = error instanceof ActionResultError ? error.failure.requestId : null
  const message =
    typeof error === 'string'
      ? error
      : error instanceof Error
        ? error.message
        : typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string'
          ? error.message
          : ''

  const normalizedMessage = message.trim()
  if (!normalizedMessage) {
    return fallback
  }

  const loweredMessage = normalizedMessage.toLowerCase()
  if (
    loweredMessage.includes('an error occurred in the server components render') ||
    loweredMessage.includes('specific message is omitted in production builds') ||
    loweredMessage.includes('digest property is included')
  ) {
    return fallback
  }

  if (loweredMessage === 'failed to fetch' || loweredMessage.includes('fetch failed')) {
    return 'Could not reach the server.'
  }

  if (requestId && requestId !== 'local') {
    return `${normalizedMessage} Reference: ${requestId}`
  }

  return normalizedMessage
}
