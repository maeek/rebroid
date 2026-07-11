import 'server-only'
import { getDatabase } from './database'

export const saveMfaSetup = (userId: string, encryptedSecret: string) => {
  const expiresAt = Date.now() + 10 * 60 * 1000
  getDatabase()
    .prepare(
      'INSERT INTO mfa_setup_tokens (user_id, encrypted_secret, expires_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET encrypted_secret = excluded.encrypted_secret, expires_at = excluded.expires_at'
    )
    .run(userId, encryptedSecret, expiresAt)
}

export const getMfaSetup = (userId: string) => {
  const row = getDatabase()
    .prepare('SELECT encrypted_secret, expires_at FROM mfa_setup_tokens WHERE user_id = ?')
    .get(userId) as { encrypted_secret: string; expires_at: number } | undefined
  return row && row.expires_at > Date.now() ? row.encrypted_secret : null
}

export const deleteMfaSetup = (userId: string) => {
  getDatabase().prepare('DELETE FROM mfa_setup_tokens WHERE user_id = ?').run(userId)
}
