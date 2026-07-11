import { PublicActionError } from '@/server/errors/public-action-error'
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

const redactBackendDetails = (value: string) =>
  value
    .replace(/\b(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}\b/g, '[redacted address]')
    .replace(/\[[0-9a-f:]+\]/gi, '[redacted address]')
    .replace(/\b(?:https?|wss?|tcp):\/\/[^\s"']+/gi, '[redacted endpoint]')
    .replace(/\b(?:sha256:)?[a-f0-9]{32,64}\b/gi, '[redacted identifier]')
    .replace(/(^|\s)\/(?:[^\s/]+\/)+[^\s]*/g, '$1[redacted path]')

export const sanitizeAndroidApplicationForUser = (app: AndroidApplication, context: AppSafetyContext) => {
  if (canViewBackendDetails(context)) {
    return app
  }

  return {
    ...app,
    status: {
      ...app.status,
      message: app.status.message ? redactBackendDetails(app.status.message) : null,
      detail: app.status.detail
        ? {
            ...app.status.detail,
            description: app.status.detail.description ? redactBackendDetails(app.status.detail.description) : null
          }
        : null,
      progress: app.status.progress
        ? { ...app.status.progress, layerId: app.status.progress.layerId ? '[redacted identifier]' : null }
        : null
    },
    errors: {
      lastError: app.errors.lastError ? redactBackendDetails(app.errors.lastError) : null,
      application: app.errors.application
        ? {
            ...app.errors.application,
            message: redactBackendDetails(app.errors.application.message),
            hint: app.errors.application.hint ? redactBackendDetails(app.errors.application.hint) : null
          }
        : null
    },
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
      networkName: 'Managed network',
      policy: {
        ...app.network.policy,
        status: app.network.policy.status ? redactBackendDetails(app.network.policy.status) : null,
        message: app.network.policy.message ? redactBackendDetails(app.network.policy.message) : null,
        result: app.network.policy.result
          ? {
              ...app.network.policy.result,
              message: redactBackendDetails(app.network.policy.result.message),
              hint: app.network.policy.result.hint ? redactBackendDetails(app.network.policy.result.hint) : null
            }
          : null
      }
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
    proxyRemote: 'managed',
    adbHost: 'Managed container',
    adbPort: 0,
    udid: 'Managed container',
    viewerMessage: session.viewerMessage ? redactBackendDetails(session.viewerMessage) : null,
    viewerError: session.viewerError
      ? {
          ...session.viewerError,
          message: redactBackendDetails(session.viewerError.message),
          command: session.viewerError.command?.map(redactBackendDetails) ?? null,
          stdout: session.viewerError.stdout ? redactBackendDetails(session.viewerError.stdout) : null,
          stderr: session.viewerError.stderr ? redactBackendDetails(session.viewerError.stderr) : null
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
    output: redactBackendDetails(log.output)
  }
}

const assertQuota = (label: string, value: number | null | undefined, max: number | null) => {
  if (value !== null && value !== undefined && max !== null && value > max) {
    throw new PublicActionError(`${label} exceeds your quota of ${max}.`, { code: 'validation', status: 422 })
  }
}

export const enforceResourceQuotas = (
  input: Pick<CreateApplicationActionInput | UpdateAndroidApplicationInput, 'memoryLimitMb' | 'cpuLimitCpus'>,
  quotas: ResourceQuota
) => {
  assertQuota('Memory limit', input.memoryLimitMb, quotas.maxMemoryMb)
  assertQuota('CPU limit', input.cpuLimitCpus, quotas.maxCpuCpus)
}

export const enforceSessionQuota = (
  input: Pick<CreateApplicationActionInput | UpdateAndroidApplicationInput, 'inactivityTimeoutSeconds'>,
  quotas: ResourceQuota
) => {
  assertQuota('Session timeout', input.inactivityTimeoutSeconds, quotas.maxSessionSeconds)
}
