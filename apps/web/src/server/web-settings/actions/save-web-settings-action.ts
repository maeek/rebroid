'use server'

import { runSafeAction } from '@/server/actions/safe-action'
import { recordAuditEvent } from '@/server/audit/events'
import { requireAdmin } from '@/server/auth/authorization'
import { saveWebSettings } from '../store'
import type { WebSettings } from '../types'

export const saveWebSettingsAction = async (settings: Partial<WebSettings>) =>
  runSafeAction(
    async () => {
      const admin = await requireAdmin()
      const saved = await saveWebSettings(settings)
      recordAuditEvent({
        actorUserId: admin.id,
        actorLabel: admin.name || admin.username || admin.id,
        category: 'settings',
        action: 'settings.web.update',
        resourceType: 'web_settings'
      })
      return saved
    },
    { fallbackMessage: 'Could not save web settings.', logLabel: 'saveWebSettingsAction failed' }
  )
