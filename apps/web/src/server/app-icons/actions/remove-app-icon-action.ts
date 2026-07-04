'use server'

import { runSafeAction } from '@/server/actions/safe-action'
import { getOwnedApplicationAction } from '@/server/orchestrator/applications/actions/queries/get-application-action'
import { revalidateAppIconPaths, requireUser } from '../shared'
import { removeStoredAppIcon } from '../store'

export const removeAppIconAction = async (appId: string) =>
  runSafeAction(
    async () => {
      await requireUser()
      await getOwnedApplicationAction(appId)
      await removeStoredAppIcon(appId)
      revalidateAppIconPaths(appId)
    },
    { fallbackMessage: 'Could not remove the icon.', logLabel: 'removeAppIconAction failed' }
  )
