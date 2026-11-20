import { useState } from 'react'
import { appRuntimeFields, readRuntimeNumber, type AppRuntimeSettingsDraft } from '../model/app-runtime-settings'
import type { AppDefinition } from '@/features/applications/domain/app-definition'
import type { UpdateAndroidApplicationInput } from '@/shared/contracts/application'

export type AppConfigurationSettings = AppRuntimeSettingsDraft & {
  name: string
  customContainerArgs: string
}

type AppManageDraft = AppConfigurationSettings & { icon: string | null }
type AppSettingsAccess = {
  canChangeContainerArgs: boolean
  canChangeResources: boolean
  canChangeSessionLimit: boolean
}
type AppSetting = keyof AppConfigurationSettings
type ModifiedSettings = Record<AppSetting, boolean>
type SettingsEdits = Partial<Record<AppSetting, { value: string; matchingSavedValue?: string }>>
const appSettingsFields = ['name', 'customContainerArgs', ...appRuntimeFields] as const

const sameSettingValue = (field: AppSetting, value: string, saved: string) => {
  if (field === 'name' || field === 'customContainerArgs') return value.trim() === saved.trim()
  return readRuntimeNumber(value) === readRuntimeNumber(saved)
}

export const appManageDraftFromApp = (app: AppDefinition): AppManageDraft => ({
  name: app.name,
  inactivityTimeoutSeconds: String(app.inactivityTimeoutSeconds),
  memoryLimitMb: app.memoryLimitMb?.toString() ?? '',
  cpuLimitCpus: app.cpuLimitCpus?.toString() ?? '',
  customContainerArgs: app.containerArgs ?? '',
  icon: app.icon ?? null
})

export const mergeAppConfiguration = (nextApp: AppDefinition, currentApp?: AppDefinition) => ({
  ...nextApp,
  icon: currentApp ? currentApp.icon : nextApp.icon,
  ownerDisplayName: currentApp?.ownerDisplayName ?? nextApp.ownerDisplayName
})

export const getModifiedAppSettings = (
  draft: AppConfigurationSettings,
  saved: AppConfigurationSettings,
  { canChangeContainerArgs, canChangeResources, canChangeSessionLimit }: AppSettingsAccess
): ModifiedSettings => ({
  name: !sameSettingValue('name', draft.name, saved.name),
  customContainerArgs:
    canChangeContainerArgs &&
    !sameSettingValue('customContainerArgs', draft.customContainerArgs, saved.customContainerArgs),
  inactivityTimeoutSeconds:
    canChangeSessionLimit &&
    !sameSettingValue('inactivityTimeoutSeconds', draft.inactivityTimeoutSeconds, saved.inactivityTimeoutSeconds),
  memoryLimitMb: canChangeResources && !sameSettingValue('memoryLimitMb', draft.memoryLimitMb, saved.memoryLimitMb),
  cpuLimitCpus: canChangeResources && !sameSettingValue('cpuLimitCpus', draft.cpuLimitCpus, saved.cpuLimitCpus)
})

export const buildAppManageUpdateInput = (
  draft: AppConfigurationSettings,
  modified: ModifiedSettings
): UpdateAndroidApplicationInput => {
  const input: UpdateAndroidApplicationInput = {}
  if (modified.name) input.name = draft.name.trim()
  if (modified.customContainerArgs) input.containerArgs = draft.customContainerArgs.trim() || null
  if (modified.inactivityTimeoutSeconds) {
    const timeout = readRuntimeNumber(draft.inactivityTimeoutSeconds)
    if (timeout !== null) input.inactivityTimeoutSeconds = timeout
  }
  if (modified.memoryLimitMb) input.memoryLimitMb = readRuntimeNumber(draft.memoryLimitMb)
  if (modified.cpuLimitCpus) input.cpuLimitCpus = readRuntimeNumber(draft.cpuLimitCpus)
  return input
}

export const useAppManageDraft = (currentApp: AppDefinition, access: AppSettingsAccess) => {
  const [settingsEdits, setSettingsEdits] = useState<SettingsEdits>({})
  const [iconEdit, setIconEdit] = useState<string | null>()
  const saved = appManageDraftFromApp(currentApp)
  const draft = { ...saved, icon: iconEdit === undefined ? saved.icon : iconEdit }
  for (const field of appSettingsFields) {
    const edit = settingsEdits[field]
    if (edit && (edit.matchingSavedValue === undefined || edit.matchingSavedValue === saved[field])) {
      draft[field] = edit.value
    }
  }
  const modified = getModifiedAppSettings(draft, saved, access)

  const updateForm = (patch: Partial<AppConfigurationSettings>) => {
    setSettingsEdits(current => {
      const next = { ...current }
      for (const field of appSettingsFields) {
        const value = patch[field]
        if (value === undefined) continue
        if (value === saved[field]) {
          delete next[field]
        } else {
          // Keep the user's formatting while it still represents the saved value.
          next[field] = {
            value,
            matchingSavedValue: sameSettingValue(field, value, saved[field]) ? saved[field] : undefined
          }
        }
      }
      return next
    })
  }

  const isSettingsDirty = Object.values(modified).some(Boolean)
  const isIconDirty = draft.icon !== saved.icon
  const resetSettings = () => setSettingsEdits({})
  const resetIcon = () => setIconEdit(undefined)
  const discardChanges = () => {
    resetSettings()
    resetIcon()
  }

  return {
    discardChanges,
    displayApp: { ...currentApp, name: draft.name },
    draft,
    modified,
    isDirty: isSettingsDirty || isIconDirty,
    isIconDirty,
    isSettingsDirty,
    resetIcon,
    resetSettings,
    updateForm,
    updateIcon: (icon: string | null) => setIconEdit(icon === saved.icon ? undefined : icon)
  }
}
