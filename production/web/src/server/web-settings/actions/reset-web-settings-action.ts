'use server'

import { requireAdminUser } from '../shared'
import { resetWebSettings } from '../store'

export const resetWebSettingsAction = async () => {
  await requireAdminUser()
  return resetWebSettings()
}
