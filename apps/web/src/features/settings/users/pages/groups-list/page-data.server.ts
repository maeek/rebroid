import { userService } from '@/server/auth/user'

export const getGroupsListPageData = async () => ({
  groups: await userService.listGroups()
})
