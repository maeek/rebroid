import { randomUUID } from 'node:crypto'
import 'server-only'
import { administratorsGroupId } from '@/shared/permissions/effective-access'
import { getDatabase } from './database'
import type { AccountSessionIdentity } from '@/server/auth/session-identity'
import type { AccountSession } from '@/shared/contracts/account-session'

const liveSession = `
  FROM account_sessions AS session
  JOIN users AS account ON account.id = session.user_id AND account.session_version = session.session_version
  WHERE session.expires_at > ? AND account.disabled = 0
`

export const insertAccountSession = (
  userId: string,
  sessionVersion: number,
  device: { browser: string; operatingSystem: string },
  lifetimeMs: number
) => {
  const client = getDatabase()
  const now = Date.now()
  const id = randomUUID()
  return client
    .transaction(() => {
      client.prepare('DELETE FROM account_sessions WHERE expires_at <= ?').run(now)
      const { changes } = client
        .prepare(
          `
        INSERT INTO account_sessions (
          id, user_id, session_version, browser, operating_system, signed_in_at, last_active_at, expires_at
        )
        SELECT ?, id, session_version, ?, ?, ?, ?, ? FROM users
        WHERE id = ? AND session_version = ? AND disabled = 0
      `
        )
        .run(id, device.browser, device.operatingSystem, now, now, now + lifetimeMs, userId, sessionVersion)
      return changes === 1 ? id : null
    })
    .immediate()
}

export const findActiveAccountSession = (identity: AccountSessionIdentity, now = Date.now()) =>
  getDatabase()
    .prepare(
      `
      SELECT session.last_active_at AS lastActiveAt, account.password_change_required AS passwordChangeRequired
      ${liveSession}
        AND session.id = ? AND session.user_id = ? AND session.session_version = ?
        AND EXISTS (SELECT 1 FROM auth_state WHERE id = 1 AND epoch = ?)
    `
    )
    .get(now, identity.sessionId, identity.userId, identity.sessionVersion, identity.authEpoch) as
    { lastActiveAt: number; passwordChangeRequired: number } | undefined

const activityIntervalMs = 5 * 60_000

export const recordAccountSessionActivity = (sessionId: string, lastActiveAt: number, now = Date.now()) => {
  if (now - lastActiveAt < activityIntervalMs) return
  getDatabase()
    .prepare('UPDATE account_sessions SET last_active_at = ? WHERE id = ? AND last_active_at <= ? AND expires_at > ?')
    .run(now, sessionId, now - activityIntervalMs, now)
}

export const extendAccountSession = (identity: AccountSessionIdentity, expiresAt: number) => {
  if (!findActiveAccountSession(identity)) return
  getDatabase()
    .prepare('UPDATE account_sessions SET expires_at = MAX(expires_at, ?) WHERE id = ?')
    .run(expiresAt, identity.sessionId)
}

type SessionRow = Omit<AccountSession, 'current' | 'signedInAt' | 'lastActiveAt'> & {
  signedInAt: number
  lastActiveAt: number
}

export const listActiveAccountSessions = (userId: string, currentSessionId?: string): AccountSession[] => {
  const rows = getDatabase()
    .prepare(
      `
      SELECT session.id, session.browser, session.operating_system AS operatingSystem,
        session.signed_in_at AS signedInAt, session.last_active_at AS lastActiveAt
      ${liveSession} AND session.user_id = ?
      ORDER BY session.id IS ? DESC, session.last_active_at DESC, session.signed_in_at DESC, session.id
    `
    )
    .all(Date.now(), userId, currentSessionId ?? null) as SessionRow[]
  return rows.map(row => ({
    ...row,
    signedInAt: new Date(row.signedInAt).toISOString(),
    lastActiveAt: new Date(row.lastActiveAt).toISOString(),
    current: row.id === currentSessionId
  }))
}

export const deleteAccountSession = (userId: string, sessionId: string) =>
  getDatabase().prepare('DELETE FROM account_sessions WHERE id = ? AND user_id = ?').run(sessionId, userId).changes

export const revokeActiveAccountSessions = (
  actor: AccountSessionIdentity,
  userId: string,
  sessionId: string | null
): number | null => {
  const client = getDatabase()
  const now = Date.now()
  return client
    .transaction(() => {
      const activeActor = findActiveAccountSession(actor, now)
      if (!activeActor || activeActor.passwordChangeRequired) return null
      if (
        actor.userId !== userId &&
        !client
          .prepare('SELECT 1 FROM group_memberships WHERE user_id = ? AND group_id = ?')
          .get(actor.userId, administratorsGroupId)
      ) {
        return null
      }
      return client
        .prepare(
          `
        DELETE FROM account_sessions WHERE id IN (
          SELECT session.id ${liveSession}
            AND session.user_id = ? AND session.id <> ? AND (? IS NULL OR session.id = ?)
        )
      `
        )
        .run(now, userId, actor.sessionId, sessionId, sessionId).changes
    })
    .immediate()
}
