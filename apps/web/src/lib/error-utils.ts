import { ActionResultError } from '@/shared/actions/action-result'

function errorMessage(error: unknown) {
  if (typeof error === 'string') return error.trim()
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message.trim()
  }
  return ''
}

function displayMessage(message: string, fallback: string) {
  const lower = message.toLowerCase()
  if (
    !message ||
    lower.includes('an error occurred in the server components render') ||
    lower.includes('specific message is omitted in production builds') ||
    lower.includes('digest property is included')
  )
    return fallback
  if (lower === 'failed to fetch' || lower.includes('fetch failed')) return 'Could not reach the server.'
  return message
}

export function getDisplayErrorMessage(
  error: unknown,
  fallback = 'The server did not return details for this failure.'
): string {
  const message = displayMessage(errorMessage(error), fallback)
  const requestId = error instanceof ActionResultError ? error.failure.requestId : undefined
  return requestId && requestId !== 'local' ? `${message} Reference: ${requestId}` : message
}
