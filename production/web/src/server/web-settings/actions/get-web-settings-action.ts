'use server'

import { requireUser } from '../shared'
import { getWebSettings } from '../store'

export const getWebSettingsAction = async () => {
  await requireUser()
  return getWebSettings()
}
