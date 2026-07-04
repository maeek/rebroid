import { userService } from '@/server/auth/user'
import { getWebSettings } from '@/server/web-settings/store'

export const getUsersListPageData = async () => {
  const [users, groups, webSettings] = await Promise.all([
    userService.listUsers(),
    userService.listGroups(),
    getWebSettings()
  ])

  return { users, groups, passwordMinimumLength: webSettings.passwordMinimumLength }
}
