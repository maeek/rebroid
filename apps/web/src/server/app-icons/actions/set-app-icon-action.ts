'use server'

import { runSafeAction } from '@/server/actions/safe-action'
import {
  requireOwnedRuntimeContext,
  ownedRuntimeMessage
} from '@/server/orchestrator/applications/actions/common/action-helpers'
import { revalidateAppIconPaths } from '../shared'
import { removeStoredAppIcon, setStoredAppIcon } from '../store'

export const setAppIconAction = async (appId: string, icon: string | null) =>
  runSafeAction(
    async () => {
      await requireOwnedRuntimeContext(appId, ownedRuntimeMessage)
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
