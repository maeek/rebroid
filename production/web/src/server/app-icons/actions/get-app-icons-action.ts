'use server'

import { getApplicationAction } from '@/server/orchestrator/applications/read-actions'
import { requireUser } from '../shared'
import { getStoredAppIcon } from '../store'

export const getAppIconsAction = async (appIds: string[]) => {
  await requireUser()
  const uniqueIds = [...new Set(appIds.filter(Boolean))]
  const entries = await Promise.all(
    uniqueIds.map(async appId => {
      try {
        await getApplicationAction(appId)
        return [appId, await getStoredAppIcon(appId)] as const
      } catch {
        return [appId, null] as const
      }
    })
  )
  return Object.fromEntries(entries)
}
