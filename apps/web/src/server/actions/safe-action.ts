import 'server-only'
import { unstable_rethrow } from 'next/navigation'
import { getDisplayErrorMessage } from '@/lib/error-utils'
import { actionError, actionOk, type ActionError, type ActionResult } from '@/shared/actions/action-result'
import { OrchestratorRequestError } from '@/server/orchestrator/request'

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

const errorCode = (error: unknown) => {
  const record = asErrorRecord(error)
  return typeof record?.code === 'string' ? record.code : undefined
}

const errorStatus = (error: unknown) => {
  if (error instanceof OrchestratorRequestError) return error.status
  if (error instanceof PublicActionError) return error.status
  const record = asErrorRecord(error)
  return typeof record?.status === 'number' ? record.status : undefined
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

export const toActionError = (error: unknown, fallbackMessage = defaultActionFailureMessage): ActionError => {
  const code = errorCode(error)
  const status = errorStatus(error)
  return {
    message: safeMessageForActionError(error, fallbackMessage),
    ...(code ? { code } : {}),
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
  try {
    return actionOk(await operation())
  } catch (error) {
    unstable_rethrow(error)
    const safeError = toActionError(error, fallbackMessage)
    console.error(logLabel, error)
    return actionError(safeError)
  }
}
