import { userService } from '@/server/auth/user'

export const getUserDetailPageData = async (id: string) => {
  const [user, groups] = await Promise.all([userService.getUserById(id), userService.listGroups()])

  return { user, groups }
}
