'use server'

import { revalidatePath } from 'next/cache'
import { recordAuditEvent } from '@/server/audit/events'
import { requireAdmin } from '@/server/auth/authorization'
import { purgeAuditEvents } from '@/server/storage/database'
import { saveWebSettings } from '@/server/web-settings/store'

const adminLabel = (admin: Awaited<ReturnType<typeof requireAdmin>>) => admin.name || admin.username || admin.id

export const purgeAllAuditEventsAction = async () => {
  const admin = await requireAdmin()
  const purged = purgeAuditEvents()
  recordAuditEvent({
    actorUserId: admin.id,
    actorLabel: adminLabel(admin),
    category: 'audit',
    action: 'audit.purge',
    resourceType: 'audit_log',
    outcome: 'success',
    details: { purged }
  })
  revalidatePath('/settings/activity')
  return { purged }
}

export const saveAuditRetentionAction = async (auditRetentionDays: number) => {
  const admin = await requireAdmin()
  const settings = await saveWebSettings({ auditRetentionDays })
  recordAuditEvent({
    actorUserId: admin.id,
    actorLabel: adminLabel(admin),
    category: 'audit',
    action: 'audit.retention.update',
    resourceType: 'audit_log',
    outcome: 'success',
    details: { auditRetentionDays: settings.auditRetentionDays }
  })
  revalidatePath('/settings/activity')
  return settings
}
