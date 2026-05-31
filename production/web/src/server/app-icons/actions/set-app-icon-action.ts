'use server'

import { getOwnedApplicationAction } from '@/server/orchestrator/applications/read-actions'
import { revalidateAppIconPaths, requireUser } from '../shared'
import { setStoredAppIcon } from '../store'

export const setAppIconAction = async (appId: string, icon: string) => {
  await requireUser()
  await getOwnedApplicationAction(appId)
  await setStoredAppIcon(appId, icon)
  revalidateAppIconPaths(appId)
  return icon
}
