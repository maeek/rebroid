'use server'

import { getServerAuthSession } from '@/server/auth/auth'
import { getWebSettings, resetWebSettings, saveWebSettings } from './store'
import type { WebSettings } from './store'

const requireUser = async () => {
  const session = await getServerAuthSession()
  if (!session?.user) {
    throw new Error('Authentication required.')
  }
}

export const getWebSettingsAction = async () => {
  await requireUser()
  return getWebSettings()
}

export const saveWebSettingsAction = async (settings: Partial<WebSettings>) => {
  await requireUser()
  return saveWebSettings(settings)
}

export const resetWebSettingsAction = async () => {
  await requireUser()
  return resetWebSettings()
}
