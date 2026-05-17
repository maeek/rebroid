'use server'

import { requireUser } from '../shared'
import { saveWebSettings } from '../store'
import type { WebSettings } from '../types'

export const saveWebSettingsAction = async (settings: Partial<WebSettings>) => {
  await requireUser()
  return saveWebSettings(settings)
}
