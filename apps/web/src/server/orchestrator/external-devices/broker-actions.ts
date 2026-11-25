'use server'

import {
  isExternalAdbTcpAllowlistEntry,
  maxExternalAdbTcpEndpoints
} from '@rebroid/android-application-core/android-device'
import { z } from 'zod'
import { runSafeAction } from '@/server/actions/safe-action'
import { recordAuditEvent } from '@/server/audit/events'
import { requireAdmin } from '@/server/auth/authorization'
import { PublicActionError } from '@/server/errors/public-action-error'
import { OrchestratorRequestError } from '../request'
import { externalDeviceClient } from './client'

const tcpPolicy = z.strictObject({
  revision: z
    .number()
    .int()
    .min(0)
    .max(Number.MAX_SAFE_INTEGER - 1),
  endpoints: z.array(z.string().max(21).refine(isExternalAdbTcpAllowlistEntry)).max(maxExternalAdbTcpEndpoints)
})

export const readExternalBrokerAvailabilityAction = async () => {
  await requireAdmin()
  return externalDeviceClient.availability()
}

export const updateExternalTcpPolicyAction = async (input: unknown) =>
  runSafeAction(
    async () => {
      const admin = await requireAdmin('api')
      const parsed = tcpPolicy.safeParse(input)
      if (!parsed.success)
        throw new PublicActionError('Enter valid IPv4 CIDR ranges or individual endpoints.', {
          code: 'validation',
          status: 400
        })
      try {
        const saved = await externalDeviceClient.updateTcpPolicy(parsed.data, admin.id)
        recordAuditEvent({
          actorUserId: admin.id,
          actorLabel: admin.name || admin.username || admin.id,
          category: 'settings',
          action: 'settings.external_adb.tcp_policy.update',
          resourceType: 'external_adb_policy',
          details: { revision: saved.revision, endpointCount: saved.endpoints.length }
        })
        return saved
      } catch (error) {
        if (error instanceof OrchestratorRequestError && error.status === 409) {
          throw new PublicActionError('The allowed endpoints changed. Reload before saving.', {
            code: 'conflict',
            status: 409
          })
        }
        throw error
      }
    },
    { fallbackMessage: 'Could not save allowed TCP endpoints.', logLabel: 'External ADB TCP policy' }
  )
