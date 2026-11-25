import { randomUUID } from 'node:crypto'
import {
  externalDeviceVerificationProofs,
  isExternalAdbTcpEndpoint
} from '@rebroid/android-application-core/android-device'
import 'server-only'
import { z } from 'zod'
import { recordApplicationAudit } from '@/server/audit/application-event'
import { userService } from '@/server/auth/user'
import { PublicActionError } from '@/server/errors/public-action-error'
import { getRequestId } from '@/server/observability/request-id'
import { deleteWebMaintenance, enqueueWebMaintenance } from '@/server/persistence/web-maintenance-repository'
import { hasPermission } from '@/shared/permissions/permissions'
import { getCurrentUserContext } from '../current-user'
import { requireFeature } from '../features'
import { OrchestratorRequestError } from '../request'
import { externalDeviceClient } from './client'
import { runExternalViewerTool } from './viewer'

const base = { name: z.string().trim().min(2).max(100) }
const tcpEndpoint = z.string().trim().refine(isExternalAdbTcpEndpoint)
const registration = z.discriminatedUnion('transport', [
  z.strictObject({ ...base, transport: z.literal('usb'), candidateId: z.uuid() }),
  z.strictObject({ ...base, transport: z.literal('tcp'), endpoint: tcpEndpoint })
])
const command = z.discriminatedUnion('action', [
  z.strictObject({ action: z.enum(['connect', 'refresh', 'disconnect', 'forget']) }),
  z.strictObject({ action: z.literal('verify'), attemptId: z.uuid(), proof: z.enum(externalDeviceVerificationProofs) }),
  z.strictObject({ action: z.literal('instructions'), attemptId: z.uuid() }),
  z.strictObject({ action: z.enum(['screenshot', 'logcat']), attachmentId: z.uuid() })
])
const forbidden = () =>
  new PublicActionError('You lack permission for this device action.', { code: 'forbidden', status: 403 })
const invalid = (message: string) => new PublicActionError(message, { code: 'validation', status: 400 })

const context = async (response?: 'api') => {
  const user = await getCurrentUserContext(response)
  return {
    actor: {
      userId: user.ownerUserId,
      administrator: user.isPlatformAdmin,
      canEnroll: hasPermission(user.permissions, 'devices:enroll-external'),
      canUse: hasPermission(user.permissions, 'devices:use-external')
    }
  }
}

export const loadExternalDeviceInventory = async (response?: 'api') => {
  const { actor } = await context(response)
  if (response === 'api') await requireFeature('feature.external-devices', response)
  const devices = await externalDeviceClient.list(actor)
  if (!actor.canEnroll && !actor.canUse && devices.length === 0) throw forbidden()
  const availability = await externalDeviceClient.availability()
  return {
    devices,
    availability,
    canEnroll: actor.canEnroll,
    canConnect: actor.canUse,
    administrator: actor.administrator,
    userId: actor.userId
  }
}

export const listExternalUsbCandidates = async () => {
  const { actor } = await context('api')
  if (!actor.canEnroll || !actor.administrator) throw forbidden()
  return externalDeviceClient.candidates(actor).catch(translateBrokerFailure)
}

export const checkExternalTcpEndpoint = async (body: unknown) => {
  const { actor } = await context('api')
  if (!actor.canEnroll) throw forbidden()
  const input = z.strictObject({ endpoint: tcpEndpoint }).safeParse(body)
  if (!input.success) throw invalid('Enter an approved IPv4 address and TCP port.')
  return externalDeviceClient.checkTcp(input.data.endpoint, actor).catch(translateBrokerFailure)
}

export const registerExternalDevice = async (body: unknown) => {
  const { actor } = await context('api')
  if (!actor.canEnroll) throw forbidden()
  const input = registration.safeParse(body)
  if (!input.success) throw invalid('Check the device name and connection target.')
  if (input.data.transport === 'usb' && !actor.administrator) throw forbidden()
  const device = await externalDeviceClient.register(input.data, actor).catch(translateBrokerFailure)
  recordApplicationAudit(actor.userId, 'application.external.register', device)
  return device
}

export const operateExternalDevice = async (id: string, body: unknown) => {
  const { actor } = await context('api')
  const input = command.safeParse(body)
  if (!input.success || !z.uuid().safeParse(id).success) throw invalid('Invalid device operation.')
  const { action } = input.data
  if (action === 'screenshot' || action === 'logcat') {
    return runExternalViewerTool(id, input.data.attachmentId, action).catch(translateBrokerFailure)
  }
  if (action === 'verify' || action === 'instructions') {
    if (!actor.canEnroll) throw forbidden()
    if (action === 'instructions') {
      return externalDeviceClient.instructions(id, input.data.attemptId, actor).catch(translateBrokerFailure)
    }
    const device = await externalDeviceClient
      .verify(id, input.data.attemptId, input.data.proof, actor)
      .catch(translateBrokerFailure)
    recordApplicationAudit(actor.userId, 'application.external.verify', device)
    return device
  }
  if (action === 'forget') {
    const device = await externalDeviceClient.get(id, actor).catch(translateBrokerFailure)
    const jobId = randomUUID()
    const tracked = enqueueWebMaintenance(
      {
        id: jobId,
        kind: 'external-device-deletion',
        applicationId: id,
        requestId: await getRequestId()
      },
      Date.now() + 30_000
    )
    try {
      const result = await externalDeviceClient.forget(id, actor)
      recordApplicationAudit(actor.userId, 'application.external.forget', device)
      return result
    } catch (error) {
      if (tracked && error instanceof OrchestratorRequestError && error.status === 403) deleteWebMaintenance(jobId)
      return translateBrokerFailure(error)
    }
  }
  let quotas
  if (action === 'refresh' && !actor.canEnroll && !actor.canUse) throw forbidden()
  if (action === 'connect') {
    if (!actor.canUse) throw forbidden()
    const registeredDevice = await externalDeviceClient.get(id, actor).catch(translateBrokerFailure)
    const owner = await userService.getUserById(registeredDevice.ownerUserId)
    if (
      !owner ||
      owner.disabled ||
      owner.passwordChangeRequired ||
      !hasPermission(owner.effectivePermissions, 'devices:use-external')
    )
      throw forbidden()
    quotas = owner.effectiveQuotas
  }
  const device = await externalDeviceClient.command(id, action, actor, quotas).catch(translateBrokerFailure)
  if (action !== 'refresh') recordApplicationAudit(actor.userId, `application.external.${action}`, device)
  return device
}

function translateBrokerFailure(error: unknown): never {
  if (!(error instanceof OrchestratorRequestError)) throw error
  if (error.details?.code === 'open_app_quota_exceeded') {
    throw new PublicActionError('Open device limit reached. Disconnect or stop a device first.', {
      code: 'conflict',
      status: 409
    })
  }
  if (error.details?.code === 'feature_disabled' || error.details?.code === 'feature_unsupported') {
    throw new PublicActionError(
      'External devices are unavailable. Check Feature management and the broker deployment.',
      {
        code: 'conflict',
        status: 409
      }
    )
  }
  if (error.status === 404)
    throw new PublicActionError('External device not found.', { code: 'not_found', status: 404 })
  if (error.status === 503)
    throw new PublicActionError('External ADB is unavailable. Check the broker and try again.', {
      code: 'upstream_unavailable',
      status: 503
    })
  if (error.details?.code === 'external_adb_endpoint_forbidden')
    throw invalid('Use an IP address and port approved for this deployment.')
  if (error.details?.code === 'external_adb_already_registered')
    throw new PublicActionError('This device is already registered.', {
      code: 'conflict',
      status: 409
    })
  if (error.status === 409)
    throw new PublicActionError('Check the current device connection and verification details.', {
      code: 'conflict',
      status: 409
    })
  throw error
}
