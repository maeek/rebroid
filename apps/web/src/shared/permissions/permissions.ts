export const permissionCategories = [
  {
    id: 'application-lifecycle',
    name: 'Application lifecycle'
  },
  {
    id: 'runtime-configuration',
    name: 'Runtime configuration'
  },
  {
    id: 'network-access',
    name: 'Network access'
  },
  {
    id: 'profiles-observability',
    name: 'Profiles and observability'
  },
  {
    id: 'automations',
    name: 'Automations'
  }
] as const

export const permissionDefinitions = [
  {
    id: 'applications:create',
    category: 'application-lifecycle',
    name: 'Create applications',
    description: 'Create managed application containers.'
  },
  {
    id: 'applications:start',
    category: 'application-lifecycle',
    name: 'Start applications',
    description: 'Start application containers and open runtime sessions.'
  },
  {
    id: 'applications:stop',
    category: 'application-lifecycle',
    name: 'Stop applications',
    description: 'Stop owned application containers.'
  },
  {
    id: 'applications:delete',
    category: 'application-lifecycle',
    name: 'Delete applications',
    description: 'Delete owned applications and their managed runtime resources.'
  },
  {
    id: 'applications:update-apk',
    category: 'application-lifecycle',
    name: 'Update APK',
    description: 'Upload or replace APK artifacts for owned applications.'
  },
  {
    id: 'applications:upload-apk',
    category: 'application-lifecycle',
    name: 'Upload APK',
    description: 'Upload APK artifacts into owned application storage.'
  },
  {
    id: 'applications:change-base-image',
    category: 'runtime-configuration',
    name: 'Change base image',
    description: 'Choose a different base container image while creating apps.'
  },
  {
    id: 'applications:use-redroid-images',
    category: 'runtime-configuration',
    name: 'Use Redroid images',
    description: 'Run images whose name starts with redroid.'
  },
  {
    id: 'applications:use-custom-images',
    category: 'runtime-configuration',
    name: 'Use custom images',
    description: 'Run non-Redroid images such as custom Android or utility images.'
  },
  {
    id: 'applications:change-resources',
    category: 'runtime-configuration',
    name: 'Change resources',
    description: 'Set CPU and memory limits.'
  },
  {
    id: 'applications:change-session-limit',
    category: 'runtime-configuration',
    name: 'Change session limit',
    description: 'Change inactivity timeout and session length related settings.'
  },
  {
    id: 'applications:change-container-args',
    category: 'runtime-configuration',
    name: 'Change container arguments',
    description: 'Override container command arguments.'
  },
  {
    id: 'applications:configure-egress',
    category: 'network-access',
    name: 'Configure egress',
    description: 'Edit per-application network allowlists.'
  },
  {
    id: 'applications:use-internet',
    category: 'network-access',
    name: 'Use internet egress',
    description: 'Allow broad outbound internet ranges such as 0.0.0.0/0.'
  },
  {
    id: 'applications:switch-profile',
    category: 'profiles-observability',
    name: 'Switch profiles',
    description: 'Run an app with another persistent or temporary profile.'
  },
  {
    id: 'applications:view-logs',
    category: 'profiles-observability',
    name: 'View logs',
    description: 'Read container and ADB logs for owned applications.'
  },
  {
    id: 'applications:transfer-files',
    category: 'profiles-observability',
    name: 'Transfer files',
    description: 'Upload and download files through the live viewer workspace.'
  },
  {
    id: 'applications:sync-clipboard',
    category: 'profiles-observability',
    name: 'Sync clipboard',
    description: 'Read and write the application clipboard from the browser.'
  },
  {
    id: 'applications:control-viewer',
    category: 'profiles-observability',
    name: 'Control viewer',
    description: 'Send navigation, rotation, power, and volume commands to owned viewer sessions.'
  },
  {
    id: 'applications:capture-screenshot',
    category: 'profiles-observability',
    name: 'Capture screenshots',
    description: 'Save screenshots from the live viewer workspace.'
  },
  {
    id: 'applications:view-backend-details',
    category: 'profiles-observability',
    name: 'View backend details',
    description: 'See container IDs, names, network names, volume names, and ADB endpoints.'
  },
  {
    id: 'automations:manage',
    category: 'automations',
    name: 'Manage automations',
    description: 'Create, edit, import, export, and delete owned automations.'
  },
  {
    id: 'automations:run',
    category: 'automations',
    name: 'Run automations',
    description: 'Run owned automations against owned application containers.'
  },
  {
    id: 'automations:run-adb-shell',
    category: 'automations',
    name: 'Run ADB shell steps',
    description: 'Allow automation steps that run Android shell commands.'
  },
  {
    id: 'automations:manage-network',
    category: 'automations',
    name: 'Manage automation network policy',
    description: 'Allow automation steps that change app container network restrictions and allowlists.'
  },
  {
    id: 'automations:run-ai',
    category: 'automations',
    name: 'Run AI automations',
    description: 'Allow automation steps that use configured AI providers and tool calls.'
  },
  {
    id: 'automations:manage-ai-providers',
    category: 'automations',
    name: 'Manage AI providers',
    description: 'Configure local and remote AI providers used by automation steps.'
  }
] as const

export type PermissionId = (typeof permissionDefinitions)[number]['id']
export type PermissionMap = Partial<Record<PermissionId, boolean>>

export type ResourceQuota = {
  maxOpenApps: number | null
  maxSessionSeconds: number | null
  maxMemoryMb: number | null
  maxCpuCpus: number | null
}

export const allPermissionIds = permissionDefinitions.map(permission => permission.id)

export const fullPermissions = allPermissionIds.reduce<PermissionMap>((permissions, id) => {
  permissions[id] = true
  return permissions
}, {})

export const defaultUserPermissions: PermissionMap = {
  'applications:create': true,
  'applications:start': true,
  'applications:stop': true,
  'applications:delete': true,
  'applications:update-apk': true,
  'applications:upload-apk': true,
  'applications:use-redroid-images': true,
  'applications:switch-profile': true,
  'applications:view-logs': true,
  'applications:transfer-files': true,
  'applications:sync-clipboard': true,
  'applications:control-viewer': true,
  'applications:capture-screenshot': true,
  'automations:manage': true,
  'automations:run': true,
  'automations:run-ai': true
}

export const defaultUserQuota: ResourceQuota = {
  maxOpenApps: 2,
  maxSessionSeconds: 3600,
  maxMemoryMb: 2048,
  maxCpuCpus: 2
}

export const unlimitedQuota: ResourceQuota = {
  maxOpenApps: null,
  maxSessionSeconds: null,
  maxMemoryMb: null,
  maxCpuCpus: null
}

export const mergePermissions = (...maps: Array<PermissionMap | null | undefined>): PermissionMap =>
  maps.reduce<PermissionMap>((merged, map) => {
    if (!map) {
      return merged
    }

    for (const id of allPermissionIds) {
      if (map[id] !== undefined) {
        merged[id] = map[id]
      }
    }

    return merged
  }, {})

export const mergeQuotas = (...quotas: Array<Partial<ResourceQuota> | null | undefined>): ResourceQuota =>
  quotas.reduce<ResourceQuota>(
    (merged, quota) => ({
      maxOpenApps: quota?.maxOpenApps !== undefined ? quota.maxOpenApps : merged.maxOpenApps,
      maxSessionSeconds: quota?.maxSessionSeconds !== undefined ? quota.maxSessionSeconds : merged.maxSessionSeconds,
      maxMemoryMb: quota?.maxMemoryMb !== undefined ? quota.maxMemoryMb : merged.maxMemoryMb,
      maxCpuCpus: quota?.maxCpuCpus !== undefined ? quota.maxCpuCpus : merged.maxCpuCpus
    }),
    { ...defaultUserQuota }
  )

export const hasPermission = (permissions: PermissionMap, permission: PermissionId) => permissions[permission] === true

export const isRedroidImage = (image: string) => {
  const normalized = image.trim().toLowerCase()
  return normalized === 'redroid' || normalized.startsWith('redroid/') || normalized.includes('/redroid/')
}
