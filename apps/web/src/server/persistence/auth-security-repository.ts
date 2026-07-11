import { randomUUID } from 'node:crypto'
import 'server-only'
import { getDatabase } from './database'

export const getAuthEpoch = () => {
  const client = getDatabase()
  const existing = client.prepare('SELECT epoch FROM auth_state WHERE id = 1').get() as { epoch: string } | undefined
  if (existing) return existing.epoch

  const epoch = randomUUID()
  client.prepare('INSERT INTO auth_state (id, epoch) VALUES (1, ?)').run(epoch)
  return epoch
}

export const consumePersistentRateLimit = (keyHash: string, limit: number, windowMs: number) => {
  const client = getDatabase()
  const now = Date.now()
  return client.transaction(() => {
    client.prepare('DELETE FROM login_rate_limits WHERE reset_at <= ?').run(now)
    const current = client
      .prepare('SELECT attempt_count, reset_at FROM login_rate_limits WHERE key_hash = ?')
      .get(keyHash) as { attempt_count: number; reset_at: number } | undefined

    if (!current) {
      client
        .prepare('INSERT INTO login_rate_limits (key_hash, attempt_count, reset_at) VALUES (?, 1, ?)')
        .run(keyHash, now + windowMs)
      return true
    }
    if (current.attempt_count >= limit) return false
    client.prepare('UPDATE login_rate_limits SET attempt_count = attempt_count + 1 WHERE key_hash = ?').run(keyHash)
    return true
  })()
}

export const clearPersistentRateLimits = (keyHashes: string[]) => {
  const remove = getDatabase().prepare('DELETE FROM login_rate_limits WHERE key_hash = ?')
  getDatabase().transaction(() => keyHashes.forEach(keyHash => remove.run(keyHash)))()
}
