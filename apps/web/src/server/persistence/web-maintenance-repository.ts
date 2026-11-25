import 'server-only'
import { getDatabase } from './database'

interface JobIdentity {
  id: string
  requestId: string
}

export interface ViewerRevocationJob extends JobIdentity {
  kind: 'viewer-revocation'
  userIds: readonly string[]
}

export type ViewerRevocationKind = 'managed' | 'external'

interface ViewerRevocationProgress {
  userIds: readonly string[]
  completed: readonly ViewerRevocationKind[]
}

export interface AppDeletionJob extends JobIdentity {
  kind: 'device-deletion' | 'external-device-deletion'
  applicationId: string
}

export type WebMaintenanceJob = ((ViewerRevocationJob & ViewerRevocationProgress) | AppDeletionJob) & {
  attempts: number
  createdAt: number
}

interface JobRow {
  id: string
  request_id: string
  attempts: number
  created_at: number
  kind: WebMaintenanceJob['kind']
  device_id: string | null
  user_ids_json: string | null
}

const toJob = ({
  id,
  request_id: requestId,
  attempts,
  created_at: createdAt,
  kind,
  device_id,
  user_ids_json
}: JobRow): WebMaintenanceJob => {
  const identity = { id, requestId, attempts, createdAt }
  if (kind !== 'viewer-revocation') return { ...identity, kind, applicationId: device_id! }
  const payload = JSON.parse(user_ids_json!) as string[] | ViewerRevocationProgress
  const progress = Array.isArray(payload) ? { userIds: payload, completed: [] } : payload
  return { ...identity, kind, ...progress }
}

export const enqueueWebMaintenance = (job: ViewerRevocationJob | AppDeletionJob, dueAt = Date.now()) =>
  getDatabase()
    .prepare(
      `INSERT INTO web_maintenance_jobs
       (id, kind, device_id, user_ids_json, request_id, created_at, next_attempt_at)
       VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(device_id) DO NOTHING`
    )
    .run(
      job.id,
      job.kind,
      job.kind !== 'viewer-revocation' ? job.applicationId : null,
      job.kind === 'viewer-revocation' ? JSON.stringify({ userIds: job.userIds, completed: [] }) : null,
      job.requestId,
      Date.now(),
      dueAt
    ).changes === 1

export const getWebMaintenance = (id: string) => {
  const row = getDatabase().prepare('SELECT * FROM web_maintenance_jobs WHERE id = ?').get(id) as JobRow | undefined
  return row ? toJob(row) : undefined
}

export const listDueWebMaintenance = (now: number, limit: number) =>
  (
    getDatabase()
      .prepare('SELECT * FROM web_maintenance_jobs WHERE next_attempt_at <= ? ORDER BY next_attempt_at, id LIMIT ?')
      .all(now, limit) as JobRow[]
  ).map(toJob)

export const deleteWebMaintenance = (id: string) => {
  getDatabase().prepare('DELETE FROM web_maintenance_jobs WHERE id = ?').run(id)
}

export const retryWebMaintenance = (id: string, dueAt: number) => {
  getDatabase()
    .prepare('UPDATE web_maintenance_jobs SET attempts = attempts + 1, next_attempt_at = ? WHERE id = ?')
    .run(dueAt, id)
}

export const markViewerRevocationComplete = (id: string, kind: ViewerRevocationKind) => {
  getDatabase()
    .prepare(
      `UPDATE web_maintenance_jobs
       SET user_ids_json = CASE json_type(user_ids_json)
         WHEN 'array' THEN json_object('userIds', json(user_ids_json), 'completed', json_array(?))
         ELSE json_insert(user_ids_json, '$.completed[#]', ?)
       END
       WHERE id = ? AND kind = 'viewer-revocation'
         AND NOT EXISTS (SELECT 1 FROM json_each(user_ids_json, '$.completed') WHERE value = ?)`
    )
    .run(kind, kind, id, kind)
}

export const hasPendingViewerRevocation = (userId: string, kind: ViewerRevocationKind = 'managed') =>
  getDatabase()
    .prepare(
      `SELECT 1 FROM web_maintenance_jobs,
         json_each(user_ids_json, CASE json_type(user_ids_json) WHEN 'array' THEN '$' ELSE '$.userIds' END) AS owners
       WHERE kind = 'viewer-revocation' AND owners.value = ?
         AND NOT EXISTS (SELECT 1 FROM json_each(user_ids_json, '$.completed') WHERE value = ?)
       LIMIT 1`
    )
    .get(userId, kind) !== undefined
