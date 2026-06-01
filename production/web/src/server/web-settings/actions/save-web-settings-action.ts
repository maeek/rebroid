'use server'

import { requireAdminUser } from '../shared'
import { saveWebSettings } from '../store'
import type { WebSettings } from '../types'

export const saveWebSettingsAction = async (settings: Partial<WebSettings>) => {
  await requireAdminUser()
  return saveWebSettings(settings)
}
