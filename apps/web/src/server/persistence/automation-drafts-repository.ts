import { randomUUID } from 'node:crypto'
import 'server-only'
import { getDatabase } from './database'

export interface AutomationDraft {
  token: string
  yaml: string
  sourceRunId: string | null
  expiresAt: string
}

const defaultLifetimeMs = 30 * 60 * 1000

export const createAutomationDraft = (
  userId: string,
  yaml: string,
  sourceRunId?: string,
  lifetimeMs = defaultLifetimeMs
): AutomationDraft => {
  const token = randomUUID()
  const createdAt = new Date()
  const expiresAt = new Date(createdAt.getTime() + lifetimeMs).toISOString()
  getDatabase()
    .prepare(
      'INSERT INTO automation_drafts (token, user_id, yaml, source_run_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .run(token, userId, yaml, sourceRunId ?? null, createdAt.toISOString(), expiresAt)
  return { token, yaml, sourceRunId: sourceRunId ?? null, expiresAt }
}

export const consumeAutomationDraft = (userId: string, token: string): AutomationDraft | null =>
  getDatabase().transaction(() => {
    const now = new Date().toISOString()
    const row = getDatabase()
      .prepare(
        'SELECT token, yaml, source_run_id, expires_at FROM automation_drafts WHERE token = ? AND user_id = ? AND consumed_at IS NULL AND expires_at > ?'
      )
      .get(token, userId, now) as
      | { token: string; yaml: string; source_run_id: string | null; expires_at: string }
      | undefined
    if (!row) return null
    getDatabase().prepare('UPDATE automation_drafts SET consumed_at = ? WHERE token = ?').run(now, token)
    return { token: row.token, yaml: row.yaml, sourceRunId: row.source_run_id, expiresAt: row.expires_at }
  })()

export const deleteExpiredAutomationDrafts = () =>
  getDatabase().prepare('DELETE FROM automation_drafts WHERE expires_at <= ?').run(new Date().toISOString()).changes
