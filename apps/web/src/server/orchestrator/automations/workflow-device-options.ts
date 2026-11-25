import 'server-only'
import { hasPermission, type PermissionMap } from '@/shared/permissions/permissions'
import { listApplicationNames } from '../applications/application-gallery-query'
import { externalDeviceClient } from '../external-devices/client'

type WorkflowUser = Parameters<typeof listApplicationNames>[0] & { permissions: PermissionMap }

export const listExternalWorkflowDevices = async (user: WorkflowUser, includeDisabled = false) => {
  if (!process.env.EXTERNAL_ADB_BROKER_SECRET || !hasPermission(user.permissions, 'devices:use-external')) return []
  if (!includeDisabled && !(await externalDeviceClient.availability()).enabled) return []
  const devices = await externalDeviceClient.list({ userId: user.ownerUserId, administrator: user.isPlatformAdmin })
  return devices.filter(device => device.ownerUserId === user.ownerUserId)
}

export const listWorkflowDeviceNames = async (user: WorkflowUser) => {
  const [managed, external] = await Promise.all([listApplicationNames(user), listExternalWorkflowDevices(user)])
  return [...managed, ...external.map(({ id, name }) => ({ id, name, kind: 'external' as const }))]
}
