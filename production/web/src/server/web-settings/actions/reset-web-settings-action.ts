'use server'

import { requireUser } from '../shared'
import { resetWebSettings } from '../store'

export const resetWebSettingsAction = async () => {
  await requireUser()
  return resetWebSettings()
}
