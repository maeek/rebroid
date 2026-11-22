import 'server-only'
import { z } from 'zod'
import { getCurrentUser } from '@/server/auth/authorization'
import { PublicActionError } from '@/server/errors/public-action-error'
import { request } from '@/server/orchestrator/request'
import { hasPermission } from '@/shared/permissions/permissions'
import type { ApplicationRuntimeSnapshot } from '@/shared/contracts/application'

const snapshotSchema = z.object({
  mimeType: z.literal('image/webp'),
  dataUrl: z
    .string()
    .max(512 * 1024)
    .regex(/^data:image\/webp;base64,[A-Za-z0-9+/]+={0,2}$/),
  capturedAt: z.iso.datetime()
})

export const readApplicationRuntimeSnapshot = async (id: string, signal?: AbortSignal) => {
  const account = await getCurrentUser('api')
  if (!hasPermission(account.effectivePermissions, 'applications:capture-screenshot')) {
    throw new PublicActionError('You do not have permission to view application snapshots.', {
      code: 'forbidden',
      status: 403
    })
  }
  return request<ApplicationRuntimeSnapshot>(
    `/apps/${encodeURIComponent(id)}/runtime/snapshot`,
    {
      headers: { 'x-rebroid-snapshot-owner': account.id },
      signal,
      redirect: 'error'
    },
    snapshotSchema
  )
}
