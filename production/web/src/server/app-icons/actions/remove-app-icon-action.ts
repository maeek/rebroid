'use server'

import { revalidateAppIconPaths, requireUser } from '../shared'
import { removeStoredAppIcon } from '../store'

export const removeAppIconAction = async (appId: string) => {
  await requireUser()
  await removeStoredAppIcon(appId)
  revalidateAppIconPaths(appId)
}
