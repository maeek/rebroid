import 'server-only'
import { getDatabase } from './database'

export interface StoredRecentApplication {
  id: string
  openedAt: number
}

const maxRecentApplications = 5

export const listRecentApplications = (userId: string): StoredRecentApplication[] =>
  (
    getDatabase()
      .prepare(
        'SELECT application_id, opened_at FROM recent_applications WHERE user_id = ? ORDER BY opened_at DESC LIMIT ?'
      )
      .all(userId, maxRecentApplications) as Array<{ application_id: string; opened_at: number }>
  ).map(row => ({ id: row.application_id, openedAt: row.opened_at }))

export const rememberRecentApplication = (userId: string, applicationId: string, openedAt = Date.now()) => {
  const client = getDatabase()
  client.transaction(() => {
    client
      .prepare(
        'INSERT INTO recent_applications (user_id, application_id, opened_at) VALUES (?, ?, ?) ON CONFLICT(user_id, application_id) DO UPDATE SET opened_at = excluded.opened_at'
      )
      .run(userId, applicationId, openedAt)
    client
      .prepare(
        'DELETE FROM recent_applications WHERE user_id = ? AND application_id NOT IN (SELECT application_id FROM recent_applications WHERE user_id = ? ORDER BY opened_at DESC LIMIT ?)'
      )
      .run(userId, userId, maxRecentApplications)
  })()
  return listRecentApplications(userId)
}

export const forgetRecentApplication = (userId: string, applicationId: string) => {
  getDatabase()
    .prepare('DELETE FROM recent_applications WHERE user_id = ? AND application_id = ?')
    .run(userId, applicationId)
  return listRecentApplications(userId)
}
