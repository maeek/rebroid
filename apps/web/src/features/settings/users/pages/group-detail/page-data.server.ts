import { requireAdmin } from '@/server/auth/authorization'
import { userService } from '@/server/auth/user'

export const getGroupDetailPageData = async (id: string) => {
  await requireAdmin()
  const groups = await userService.listGroups()

  return {
    group: groups.find(item => item.id === id)
  }
}
