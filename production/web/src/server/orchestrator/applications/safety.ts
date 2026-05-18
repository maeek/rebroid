import { hasPermission, type PermissionMap, type ResourceQuota } from '@/shared/permissions/permissions'
import type { AndroidApplication, CreateApplicationActionInput, UpdateAndroidApplicationInput } from './types'

type AppSafetyContext = {
  role: 'admin' | 'user'
  permissions: PermissionMap
  quotas: ResourceQuota
}

const canViewBackendDetails = (context: AppSafetyContext) =>
  context.role === 'admin' || hasPermission(context.permissions, 'applications:view-backend-details')

export const sanitizeAndroidApplicationForUser = (app: AndroidApplication, context: AppSafetyContext) => {
  if (canViewBackendDetails(context)) {
    return app
  }

  return {
    ...app,
    runtime: {
      ...app.runtime,
      containerName: 'Managed container',
      containerId: null,
      adbPort: 0
    },
    storage: {
      ...app.storage,
      volumeName: app.storage.profileMode === 'temporary' ? 'Temporary profile' : 'Persistent profile'
    },
    network: {
      ...app.network,
      networkName: 'Managed network'
    },
    apk: {
      ...app.apk,
      filePath: null
    }
  }
}

const assertQuota = (label: string, value: number | null | undefined, max: number | null) => {
  if (value !== null && value !== undefined && max !== null && value > max) {
    throw new Error(`${label} exceeds your quota of ${max}.`)
  }
}

export const enforceResourceQuotas = (
  input: Pick<
    CreateApplicationActionInput | UpdateAndroidApplicationInput,
    'memoryLimitMb' | 'cpuLimitCpus' | 'volumeSizeLimitMb'
  >,
  quotas: ResourceQuota
) => {
  assertQuota('Memory limit', input.memoryLimitMb, quotas.maxMemoryMb)
  assertQuota('CPU limit', input.cpuLimitCpus, quotas.maxCpuCpus)
  assertQuota('Volume size limit', input.volumeSizeLimitMb, quotas.maxVolumeSizeMb)
}

export const enforceSessionQuota = (
  input: Pick<CreateApplicationActionInput | UpdateAndroidApplicationInput, 'inactivityTimeoutSeconds'>,
  quotas: ResourceQuota
) => {
  assertQuota('Session timeout', input.inactivityTimeoutSeconds, quotas.maxSessionSeconds)
}
