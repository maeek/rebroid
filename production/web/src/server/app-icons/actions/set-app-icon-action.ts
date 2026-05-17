'use server'

import { revalidateAppIconPaths, requireUser } from '../shared'
import { setStoredAppIcon } from '../store'

export const setAppIconAction = async (appId: string, icon: string) => {
  await requireUser()
  await setStoredAppIcon(appId, icon)
  revalidateAppIconPaths(appId)
  return icon
}
