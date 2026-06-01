import { hasPermission, type PermissionMap, type ResourceQuota } from '@/shared/permissions/permissions'
import type {
  AndroidApplication,
  ApplicationLog,
  CreateApplicationActionInput,
  ScrcpySession,
  UpdateAndroidApplicationInput
} from './types'

type AppSafetyContext = {
  role: 'admin' | 'user'
  permissions: PermissionMap
  quotas: ResourceQuota
}

const canViewBackendDetails = (context: AppSafetyContext) =>
  context.role === 'admin' || hasPermission(context.permissions, 'applications:view-backend-details')

const redactBackendAddresses = (value: string) =>
  value.replace(/\b(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}\b/g, '[redacted address]')

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

export const sanitizeScrcpySessionForUser = (session: ScrcpySession, context: AppSafetyContext): ScrcpySession => {
  if (canViewBackendDetails(context)) {
    return session
  }

  return {
    ...session,
    adbHost: 'Managed container',
    adbPort: 0,
    udid: 'Managed container',
    viewerMessage: session.viewerMessage ? redactBackendAddresses(session.viewerMessage) : null,
    viewerError: session.viewerError
      ? {
          ...session.viewerError,
          message: redactBackendAddresses(session.viewerError.message),
          command: session.viewerError.command?.map(redactBackendAddresses) ?? null,
          stdout: session.viewerError.stdout ? redactBackendAddresses(session.viewerError.stdout) : null,
          stderr: session.viewerError.stderr ? redactBackendAddresses(session.viewerError.stderr) : null
        }
      : null,
    displaySession: session.displaySession
  }
}

export const sanitizeApplicationLogForUser = (log: ApplicationLog, context: AppSafetyContext): ApplicationLog => {
  if (canViewBackendDetails(context)) {
    return log
  }

  return {
    ...log,
    output: redactBackendAddresses(log.output)
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
