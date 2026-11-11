import { getAuthEpoch } from '@/server/persistence/auth-security-repository'
import { userService } from './user'
import type { AdministratorMutation } from './user-store'

export const completeTestAdministratorSetup = async (): Promise<AdministratorMutation> => {
  const admin = await userService.completeRequiredPasswordChange(
    'admin',
    'initial-admin-password',
    'replacement-admin-password'
  )
  return {
    identity: { userId: admin.id, sessionVersion: admin.sessionVersion, authEpoch: getAuthEpoch() },
    requestId: 'test-request'
  }
}
