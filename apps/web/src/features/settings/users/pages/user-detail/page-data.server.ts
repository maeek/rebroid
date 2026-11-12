import { requireAdmin } from '@/server/auth/authorization'
import { userService } from '@/server/auth/user'
import { listActiveAccountSessions } from '@/server/persistence/account-sessions-repository'

export const getUserDetailPageData = async (id: string) => {
  const admin = await requireAdmin()
  const [user, groups] = await Promise.all([userService.getUserById(id), userService.listGroups()])

  return { user, groups, sessions: user && id !== admin.id ? listActiveAccountSessions(id) : undefined }
}
