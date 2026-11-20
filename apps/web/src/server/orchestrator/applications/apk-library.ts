import 'server-only'
import { z } from 'zod'
import { recordAuditEvent } from '@/server/audit/events'
import { PublicActionError } from '@/server/errors/public-action-error'
import { hasPermission } from '@/shared/permissions/permissions'
import { getCurrentUserContext } from '../current-user'
import { OrchestratorRequestError } from '../request'
import { orchestratorApkUploadsClient } from './apk-client'
import type { PermissionId } from '@/shared/permissions/permissions'

const mutation = z.object({
  action: z.enum(['block', 'unblock', 'delete']),
  ids: z.array(z.string().max(300)).min(1).max(100),
  scope: z.enum(['sha256', 'package']).optional(),
  reason: z.string().trim().max(500).optional()
})

const forbidden = () =>
  new PublicActionError('You do not have access to this APK operation.', {
    code: 'forbidden',
    status: 403
  })

export const loadApkLibrary = async () => {
  const { permissions } = await getCurrentUserContext()
  if (!hasPermission(permissions, 'apks:review')) throw forbidden()
  return {
    entries: await orchestratorApkUploadsClient.listLibrary(),
    canDelete: hasPermission(permissions, 'apks:delete'),
    canBlock: hasPermission(permissions, 'apks:block')
  }
}

export const mutateApkLibrary = async (input: unknown) => {
  const { ownerUserId, permissions } = await getCurrentUserContext()
  if (!hasPermission(permissions, 'apks:review')) throw forbidden()
  const parsed = mutation.safeParse(input)
  if (!parsed.success) {
    throw new PublicActionError('Choose up to 100 APKs and a valid action.', { code: 'validation', status: 400 })
  }
  const data = parsed.data
  const permission = data.action === 'delete' ? 'apks:delete' : 'apks:block'
  if (!hasPermission(permissions, permission)) throw forbidden()
  if (data.action !== 'delete' && (!data.scope || (data.action === 'block' && !data.reason))) {
    throw new PublicActionError('Choose a block scope and enter a reason when blocking.', {
      code: 'validation',
      status: 400
    })
  }
  const result = await orchestratorApkUploadsClient.mutateLibrary(data)
  recordAuditEvent({
    actorUserId: ownerUserId,
    actorLabel: ownerUserId,
    category: 'apk',
    action: `apk.${data.action}`,
    resourceType: 'apk',
    details: { ids: data.ids, scope: data.scope, reason: data.reason, ...result }
  })
  return result
}

export const readOwnedApks = async (selectedId: string | null) => {
  const user = await getCurrentUserContext()
  const allowed: PermissionId[] = ['applications:create', 'applications:update-apk']
  if (!allowed.some(permission => hasPermission(user.permissions, permission))) throw forbidden()
  if (selectedId !== null) {
    if (!z.uuid().safeParse(selectedId).success) {
      throw new PublicActionError('Choose a valid APK.', { code: 'validation', status: 400 })
    }
    try {
      return await orchestratorApkUploadsClient.getUploadedApk(selectedId, user.ownerUserId)
    } catch (error) {
      if (error instanceof OrchestratorRequestError && error.status === 409) {
        throw new PublicActionError('This APK is unavailable. Choose another file.', { code: 'conflict', status: 409 })
      }
      throw error
    }
  }
  const uploads = await orchestratorApkUploadsClient.listUploadedApks(user.ownerUserId)
  return uploads.map(({ id, displayName, originalName, packageName, sizeBytes }) => ({
    id,
    displayName,
    originalName,
    packageName,
    sizeBytes
  }))
}
