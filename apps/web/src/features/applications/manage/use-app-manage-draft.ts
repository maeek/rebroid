import { useState } from 'react'
import type { AppFormValues } from '@/features/applications/create/create-app-form.types'
import type { AppDefinition } from '@/features/applications/domain/app-definition'

type AppManageDraft = {
  appName: string
  containerArgs: string
  cpuLimitCpus: string
  icon: string | null
  inactivityTimeoutSeconds: number
  memoryLimitMb: string
}

export const appManageDraftFromApp = (app: AppDefinition): AppManageDraft => ({
  appName: app.name,
  inactivityTimeoutSeconds: app.inactivityTimeoutSeconds,
  memoryLimitMb: app.memoryLimitMb?.toString() ?? '',
  cpuLimitCpus: app.cpuLimitCpus?.toString() ?? '',
  containerArgs: app.containerArgs ?? '',
  icon: app.icon ?? null
})

export const mergeAppConfiguration = (nextApp: AppDefinition, currentApp?: AppDefinition) => ({
  ...nextApp,
  icon: currentApp ? currentApp.icon : nextApp.icon,
  ownerDisplayName: currentApp?.ownerDisplayName ?? nextApp.ownerDisplayName
})

const resourceLimitUpdate = (value: string, savedValue: number | null) => {
  if (value !== '') return Number(value)
  return savedValue === null ? undefined : null
}

export const buildAppManageUpdateInput = ({
  canChangeContainerArgs,
  canChangeResources,
  canChangeSessionLimit,
  currentApp,
  draft
}: {
  canChangeContainerArgs: boolean
  canChangeResources: boolean
  canChangeSessionLimit: boolean
  currentApp: Pick<AppDefinition, 'memoryLimitMb' | 'cpuLimitCpus'>
  draft: AppManageDraft
}) => ({
  name: draft.appName,
  inactivityTimeoutSeconds: canChangeSessionLimit ? draft.inactivityTimeoutSeconds : undefined,
  memoryLimitMb: canChangeResources ? resourceLimitUpdate(draft.memoryLimitMb, currentApp.memoryLimitMb) : undefined,
  cpuLimitCpus: canChangeResources ? resourceLimitUpdate(draft.cpuLimitCpus, currentApp.cpuLimitCpus) : undefined,
  containerArgs: canChangeContainerArgs ? draft.containerArgs.trim() || null : undefined
})

export const useAppManageDraft = (currentApp: AppDefinition) => {
  const [settingsEdits, setSettingsEdits] = useState<Partial<Omit<AppManageDraft, 'icon'>>>({})
  const [iconEdit, setIconEdit] = useState<string | null>()
  const saved = appManageDraftFromApp(currentApp)
  const draft = { ...saved, ...settingsEdits, icon: iconEdit === undefined ? saved.icon : iconEdit }

  const formValues = {
    name: draft.appName,
    containerImage: currentApp.containerImage,
    inactivityTimeoutSeconds: draft.inactivityTimeoutSeconds,
    memoryLimitMb: draft.memoryLimitMb,
    cpuLimitCpus: draft.cpuLimitCpus,
    customContainerArgs: draft.containerArgs,
    redroidDisplayProfileId: 'custom',
    redroidCustomDisplayWidth: '',
    redroidCustomDisplayHeight: '',
    redroidCustomDisplayDpi: '',
    redroidExtraArgs: ''
  } satisfies AppFormValues

  const updateForm = (patch: Partial<AppFormValues>) => {
    setSettingsEdits(current => ({
      ...current,
      ...(patch.name !== undefined ? { appName: patch.name } : {}),
      ...(patch.inactivityTimeoutSeconds !== undefined
        ? { inactivityTimeoutSeconds: patch.inactivityTimeoutSeconds }
        : {}),
      ...(patch.memoryLimitMb !== undefined ? { memoryLimitMb: patch.memoryLimitMb } : {}),
      ...(patch.cpuLimitCpus !== undefined ? { cpuLimitCpus: patch.cpuLimitCpus } : {}),
      ...(patch.customContainerArgs !== undefined ? { containerArgs: patch.customContainerArgs } : {})
    }))
  }

  const isSettingsDirty =
    draft.appName !== saved.appName ||
    draft.inactivityTimeoutSeconds !== saved.inactivityTimeoutSeconds ||
    draft.memoryLimitMb !== saved.memoryLimitMb ||
    draft.cpuLimitCpus !== saved.cpuLimitCpus ||
    draft.containerArgs !== saved.containerArgs
  const isIconDirty = draft.icon !== saved.icon
  const resetSettings = () => setSettingsEdits({})
  const resetIcon = () => setIconEdit(undefined)
  const discardChanges = () => {
    resetSettings()
    resetIcon()
  }

  return {
    discardChanges,
    displayApp: { ...currentApp, name: draft.appName },
    draft,
    formValues,
    isDirty: isSettingsDirty || isIconDirty,
    isIconDirty,
    isSettingsDirty,
    resetIcon,
    resetSettings,
    updateForm,
    updateIcon: (icon: string | null) => setIconEdit(icon === saved.icon ? undefined : icon)
  }
}
