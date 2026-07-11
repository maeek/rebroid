'use server'

import { runSafeAction } from '@/server/actions/safe-action'
import { getCurrentUser } from '@/server/auth/authorization'
import { userService } from '@/server/auth/user'

export const beginMfaSetupAction = async (currentPassword: string) =>
  runSafeAction(async () => userService.beginMfaSetup((await getCurrentUser()).id, currentPassword), {
    fallbackMessage: 'Could not start multi-factor authentication setup.',
    logLabel: 'beginMfaSetupAction failed'
  })

export const confirmMfaSetupAction = async (code: string) =>
  runSafeAction(async () => userService.confirmMfaSetup((await getCurrentUser()).id, code), {
    fallbackMessage: 'Could not enable multi-factor authentication.',
    logLabel: 'confirmMfaSetupAction failed'
  })

export const disableMfaAction = async (input: { currentPassword: string; code: string }) =>
  runSafeAction(async () => userService.disableMfa((await getCurrentUser()).id, input.currentPassword, input.code), {
    fallbackMessage: 'Could not disable multi-factor authentication.',
    logLabel: 'disableMfaAction failed'
  })
