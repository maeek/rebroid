import 'server-only'
import { PublicActionError } from '@/server/errors/public-action-error'
import {
  findActiveAccountSession,
  insertAccountSession,
  recordAccountSessionActivity,
  revokeActiveAccountSessions
} from '@/server/persistence/account-sessions-repository'
import { getAuthEpoch } from '@/server/persistence/auth-security-repository'
import { describeAccountSessionDevice } from './account-session-device'
import type { AccountSessionIdentity } from './session-identity'

export const accountSessionMaxAgeSeconds = 30 * 24 * 60 * 60

export const startAccountSession = (user: { id: string; sessionVersion: number }, userAgent: unknown) => {
  const authEpoch = getAuthEpoch()
  const sessionId = insertAccountSession(
    user.id,
    user.sessionVersion,
    describeAccountSessionDevice(userAgent),
    accountSessionMaxAgeSeconds * 1000
  )
  return sessionId ? { userId: user.id, sessionVersion: user.sessionVersion, sessionId, authEpoch } : null
}

export const checkAccountSession = (identity: AccountSessionIdentity, { recordActivity = false } = {}) => {
  const active = findActiveAccountSession(identity)
  if (!active) return null
  if (recordActivity) recordAccountSessionActivity(identity.sessionId, active.lastActiveAt)
  return { passwordChangeRequired: Boolean(active.passwordChangeRequired) }
}

type AccountSessionState = { id: string; sessionVersion: number; disabled: boolean }

export const isCurrentAccountSession = (account: AccountSessionState, identity: AccountSessionIdentity) =>
  account.id === identity.userId &&
  !account.disabled &&
  account.sessionVersion === identity.sessionVersion &&
  Boolean(checkAccountSession(identity))

export const revokeAccountSessions = (actor: AccountSessionIdentity, userId: string, sessionId: string | null) => {
  const count = revokeActiveAccountSessions(actor, userId, sessionId)
  if (count === null) {
    throw new PublicActionError('Your access changed. Sign in again and retry.', { code: 'forbidden', status: 403 })
  }
  return count
}
