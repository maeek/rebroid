'use server'

import { recordAuditEvent } from '@/server/audit/events'
import { requireAdminUser } from '../shared'
import { resetWebSettings } from '../store'

export const resetWebSettingsAction = async () => {
  const admin = await requireAdminUser()
  const settings = await resetWebSettings()
  recordAuditEvent(admin.id, 'settings.web.reset')
  return settings
}
