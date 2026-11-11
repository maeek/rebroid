import 'server-only'
import { recordAuditEvent } from '@/server/audit/events'
import { requireAdmin } from '@/server/auth/authorization'
import { PublicActionError } from '@/server/errors/public-action-error'
import { request } from '@/server/orchestrator/request'
import { androidRenderingSettingsSchema } from '@/shared/contracts/android-rendering-settings'

const path = '/settings/android-rendering'

export const readAndroidRenderingSettings = async () => {
  await requireAdmin()
  return request(path, undefined, androidRenderingSettingsSchema)
}

export const saveAndroidRenderingSettings = async (input: unknown) => {
  const admin = await requireAdmin()
  const parsed = androidRenderingSettingsSchema.safeParse(input)
  if (!parsed.success) {
    throw new PublicActionError('Enter valid Android rendering settings.', {
      code: 'validation',
      status: 400,
      fieldErrors: parsed.error.flatten().fieldErrors
    })
  }
  const saved = await request(
    path,
    { method: 'PUT', body: JSON.stringify(parsed.data) },
    androidRenderingSettingsSchema
  )
  recordAuditEvent({
    actorUserId: admin.id,
    actorLabel: admin.name || admin.username || admin.id,
    category: 'settings',
    action: 'settings.android_rendering.update',
    resourceType: 'android_rendering',
    details: saved
  })
  return saved
}
