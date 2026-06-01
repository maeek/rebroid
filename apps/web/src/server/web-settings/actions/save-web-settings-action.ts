'use server'

import { recordAuditEvent } from '@/server/audit/events'
import { requireAdminUser } from '../shared'
import { saveWebSettings } from '../store'
import type { WebSettings } from '../types'

export const saveWebSettingsAction = async (settings: Partial<WebSettings>) => {
  const admin = await requireAdminUser()
  const saved = await saveWebSettings(settings)
  recordAuditEvent(admin.id, 'settings.web.update')
  return saved
}
