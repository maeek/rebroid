import { requireAdmin } from '@/server/auth/authorization'
import { userService } from '@/server/auth/user'

export const getGroupsListPageData = async () => {
  await requireAdmin()
  return { groups: await userService.listGroups() }
}
