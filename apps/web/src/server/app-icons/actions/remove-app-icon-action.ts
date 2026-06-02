'use server'

import { getOwnedApplicationAction } from '@/server/orchestrator/applications/actions/queries/get-application-action'
import { revalidateAppIconPaths, requireUser } from '../shared'
import { removeStoredAppIcon } from '../store'

export const removeAppIconAction = async (appId: string) => {
  await requireUser()
  await getOwnedApplicationAction(appId)
  await removeStoredAppIcon(appId)
  revalidateAppIconPaths(appId)
}
