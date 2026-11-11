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

export interface AppDeletionJob extends JobIdentity {
  kind: 'app-deletion'
  applicationId: string
}

export type WebMaintenanceJob = (ViewerRevocationJob | AppDeletionJob) & { attempts: number; createdAt: number }

interface JobRow {
  id: string
  request_id: string
  attempts: number
  created_at: number
  kind: WebMaintenanceJob['kind']
  application_id: string | null
  user_ids_json: string | null
}

const toJob = ({
  id,
  request_id: requestId,
  attempts,
  created_at: createdAt,
  kind,
  application_id,
  user_ids_json
}: JobRow): WebMaintenanceJob =>
  kind === 'app-deletion'
    ? { id, kind, requestId, attempts, createdAt, applicationId: application_id! }
    : { id, kind, requestId, attempts, createdAt, userIds: JSON.parse(user_ids_json!) as string[] }

export const enqueueWebMaintenance = (job: ViewerRevocationJob | AppDeletionJob, dueAt = Date.now()) =>
  getDatabase()
    .prepare(
      `INSERT INTO web_maintenance_jobs
       (id, kind, application_id, user_ids_json, request_id, created_at, next_attempt_at)
       VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(application_id) DO NOTHING`
    )
    .run(
      job.id,
      job.kind,
      job.kind === 'app-deletion' ? job.applicationId : null,
      job.kind === 'viewer-revocation' ? JSON.stringify(job.userIds) : null,
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

export const hasPendingViewerRevocation = (userId: string) =>
  getDatabase()
    .prepare(
      `SELECT 1 FROM web_maintenance_jobs, json_each(user_ids_json)
       WHERE kind = 'viewer-revocation' AND json_each.value = ? LIMIT 1`
    )
    .get(userId) !== undefined
