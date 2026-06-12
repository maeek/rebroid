import { userService } from '@/server/auth/user'

export const getUsersListPageData = async () => {
  const [users, groups] = await Promise.all([userService.listUsers(), userService.listGroups()])

  return { users, groups }
}
