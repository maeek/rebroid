export type AppRuntimeSettingsDraft = {
  inactivityTimeoutSeconds: string
  memoryLimitMb: string
  cpuLimitCpus: string
}

type AppRuntimeField = keyof AppRuntimeSettingsDraft
export type AppRuntimeFields = Partial<Record<AppRuntimeField, boolean>>
export type AppRuntimeFieldErrors = Partial<Record<AppRuntimeField, string>>

export const appRuntimeFields = ['inactivityTimeoutSeconds', 'memoryLimitMb', 'cpuLimitCpus'] as const

export const readRuntimeNumber = (value: string) => (value.trim() ? Number(value) : null)
