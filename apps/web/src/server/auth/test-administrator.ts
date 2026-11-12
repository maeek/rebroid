import { startAccountSession } from './account-sessions'
import { userService } from './user'
import type { AdministratorMutation } from './user-store'

export const createTestSessionIdentity = (user: { id: string; sessionVersion: number }) => {
  const identity = startAccountSession(user, 'Test browser')
  if (!identity) throw new Error('Could not create test session.')
  return identity
}

export const completeTestAdministratorSetup = async (): Promise<AdministratorMutation> => {
  const admin = await userService.completeRequiredPasswordChange(
    'admin',
    'initial-admin-password',
    'replacement-admin-password'
  )
  return {
    identity: createTestSessionIdentity(admin),
    requestId: 'test-request'
  }
}
