import { getCurrentSessionIdentity, getCurrentUser } from '@/server/auth/authorization'
import { listActiveAccountSessions } from '@/server/persistence/account-sessions-repository'

export const getPreferencesSecurityPageData = async () => {
  const [{ mfaEnabled }, identity] = await Promise.all([getCurrentUser(), getCurrentSessionIdentity()])
  return { mfaEnabled, sessions: listActiveAccountSessions(identity.userId, identity.sessionId) }
}
