import 'server-only'
import { getAuthEpoch } from '@/server/persistence/auth-security-repository'

export type AccountSessionIdentity = {
  userId: string
  sessionVersion: number
  authEpoch: string
}

type AccountSessionState = { id: string; sessionVersion: number; disabled: boolean }

export const isCurrentAccountSession = (account: AccountSessionState, session: AccountSessionIdentity) =>
  account.id === session.userId &&
  !account.disabled &&
  account.sessionVersion === session.sessionVersion &&
  session.authEpoch === getAuthEpoch()
