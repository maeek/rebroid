'use server'

import { revalidatePath } from 'next/cache'
import { getServerAuthSession } from '@/server/auth/auth'
import { removeStoredAppIcon, setStoredAppIcon } from './store'

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
