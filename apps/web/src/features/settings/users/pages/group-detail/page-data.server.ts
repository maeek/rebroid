import { userService } from '@/server/auth/user'

export const getGroupDetailPageData = async (id: string) => {
  const groups = await userService.listGroups()

  return {
    group: groups.find(item => item.id === id)
  }
}
