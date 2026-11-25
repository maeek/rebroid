import 'server-only'
import { getDatabase } from './database'

interface StoredRecentApplication {
  id: string
  openedAt: number
}

const maxRecentApplications = 5

export const listRecentApplications = (userId: string): StoredRecentApplication[] =>
  (
    getDatabase()
      .prepare(
        'SELECT device_id, opened_at FROM recent_devices WHERE user_id = ? AND opened_at >= 0 ORDER BY opened_at DESC LIMIT ?'
      )
      .all(userId, maxRecentApplications) as Array<{ device_id: string; opened_at: number }>
  ).map(row => ({ id: row.device_id, openedAt: row.opened_at }))

export const rememberRecentApplication = (userId: string, applicationId: string, openedAt = Date.now()) => {
  const client = getDatabase()
  client.transaction(() => {
    client
      .prepare(
        'INSERT INTO recent_devices (user_id, device_id, opened_at) VALUES (?, ?, ?) ON CONFLICT(user_id, device_id) DO UPDATE SET opened_at = excluded.opened_at'
      )
      .run(userId, applicationId, openedAt)
    client
      .prepare(
        'DELETE FROM recent_devices WHERE user_id = ? AND opened_at >= 0 AND device_id NOT IN (SELECT device_id FROM recent_devices WHERE user_id = ? AND opened_at >= 0 ORDER BY opened_at DESC LIMIT ?)'
      )
      .run(userId, userId, maxRecentApplications)
  })()
  return listRecentApplications(userId)
}

// A negative timestamp suppresses the automatic running shortcut until the next visit.
export const dismissRecentApplication = (userId: string, applicationId: string) => {
  getDatabase()
    .prepare(
      'INSERT INTO recent_devices (user_id, device_id, opened_at) VALUES (?, ?, -1) ON CONFLICT(user_id, device_id) DO UPDATE SET opened_at = excluded.opened_at'
    )
    .run(userId, applicationId)
}

export const listDismissedRecentApplicationIds = (userId: string) =>
  new Set(
    (
      getDatabase()
        .prepare('SELECT device_id FROM recent_devices WHERE user_id = ? AND opened_at < 0')
        .all(userId) as Array<{ device_id: string }>
    ).map(row => row.device_id)
  )

export const forgetDeletedApplication = (applicationId: string) => {
  getDatabase().prepare('DELETE FROM recent_devices WHERE device_id = ?').run(applicationId)
}
