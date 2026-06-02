'use server'

import { recordAuditEvent } from '@/server/audit/events'
import { requireAdminUser } from '../shared'
import { resetWebSettings } from '../store'

export const resetWebSettingsAction = async () => {
  const admin = await requireAdminUser()
  const settings = await resetWebSettings()
  recordAuditEvent({
    actorUserId: admin.id,
    actorLabel: admin.name || admin.username || admin.id,
    category: 'settings',
    action: 'settings.web.reset',
    resourceType: 'web_settings'
  })
  return settings
}
