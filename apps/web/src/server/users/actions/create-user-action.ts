'use server'

import { runSafeAction } from '@/server/actions/safe-action'
import { recordAuditEvent } from '@/server/audit/events'
import { userService } from '@/server/auth/user'
import { requireAdminUser, revalidateUsersPage } from '../shared'
import type { UserEditorInput } from '@/shared/contracts/auth-user'

export const createUserAction = async (input: UserEditorInput & { username: string; password: string }) =>
  runSafeAction(
    async () => {
      const admin = await requireAdminUser()
      const user = await userService.createUser(input)
      recordAuditEvent({
        actorUserId: admin.id,
        actorLabel: admin.name || admin.username || admin.id,
        category: 'user',
        action: 'user.create',
        resourceType: 'user',
        resourceId: user.id,
        resourceLabel: user.name || user.username,
        details: { username: user.username }
      })
      revalidateUsersPage()
      return user
    },
    { fallbackMessage: 'Could not create user.', logLabel: 'createUserAction failed' }
  )
