'use server'

import { revalidatePath } from 'next/cache'
import { getServerAuthSession } from '@/server/auth/auth'
import { getApplicationAction } from '../orchestrator/actions'
import { getStoredAppIcon, removeStoredAppIcon, setStoredAppIcon } from './store'

const requireUser = async () => {
  const session = await getServerAuthSession()
  if (!session?.user) {
    throw new Error('Authentication required.')
  }
}

export const setAppIconAction = async (appId: string, icon: string) => {
  await requireUser()
  await setStoredAppIcon(appId, icon)
  revalidatePath('/apps')
  revalidatePath(`/app/${appId}`)
  revalidatePath(`/app/${appId}/manage`)
  return icon
}

export const removeAppIconAction = async (appId: string) => {
  await requireUser()
  await removeStoredAppIcon(appId)
  revalidatePath('/apps')
  revalidatePath(`/app/${appId}`)
  revalidatePath(`/app/${appId}/manage`)
}

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
