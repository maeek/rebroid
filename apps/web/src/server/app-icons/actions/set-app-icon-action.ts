'use server'

import { runSafeAction } from '@/server/actions/safe-action'
import { getCurrentUser } from '@/server/auth/authorization'
import { getOwnedApplicationAction } from '@/server/orchestrator/applications/actions/queries/get-application-action'
import { revalidateAppIconPaths } from '../shared'
import { removeStoredAppIcon, setStoredAppIcon } from '../store'

export const setAppIconAction = async (appId: string, icon: string | null) =>
  runSafeAction(
    async () => {
      await getCurrentUser()
      await getOwnedApplicationAction(appId)
      let savedIcon = null
      if (icon === null) await removeStoredAppIcon(appId)
      else savedIcon = await setStoredAppIcon(appId, icon)
      revalidateAppIconPaths(appId)
      return savedIcon
    },
    {
      fallbackMessage: icon === null ? 'Could not remove the icon.' : 'Could not save the icon.',
      logLabel: 'setAppIconAction failed'
    }
  )
