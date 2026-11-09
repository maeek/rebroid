import { useCallback, useEffect, useRef, useState } from 'react'
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

const draftFromApp = (app?: AppDefinition): AppManageDraft => ({
  appName: app?.name || '',
  inactivityTimeoutSeconds: app?.inactivityTimeoutSeconds ?? 900,
  memoryLimitMb: app?.memoryLimitMb?.toString() ?? '',
  cpuLimitCpus: app?.cpuLimitCpus?.toString() ?? '',
  containerArgs: app?.containerArgs ?? '',
  icon: app?.icon ?? null
})

export const mergeAppPreservingDraftAssets = (nextApp: AppDefinition, currentApp?: AppDefinition) => ({
  ...nextApp,
  icon: currentApp?.icon ?? nextApp.icon,
  ownerDisplayName: currentApp?.ownerDisplayName ?? nextApp.ownerDisplayName
})

export const buildAppManageUpdateInput = ({
  canChangeContainerArgs,
  canChangeResources,
  canChangeSessionLimit,
  draft
}: {
  canChangeContainerArgs: boolean
  canChangeResources: boolean
  canChangeSessionLimit: boolean
  draft: AppManageDraft
}) => ({
  name: draft.appName,
  inactivityTimeoutSeconds: canChangeSessionLimit ? draft.inactivityTimeoutSeconds : undefined,
  memoryLimitMb: canChangeResources && draft.memoryLimitMb ? Number(draft.memoryLimitMb) : undefined,
  cpuLimitCpus: canChangeResources && draft.cpuLimitCpus ? Number(draft.cpuLimitCpus) : undefined,
  containerArgs: canChangeContainerArgs ? draft.containerArgs.trim() || null : undefined
})

export const useAppManageDraft = (currentApp: AppDefinition) => {
  const [draft, setDraft] = useState(() => draftFromApp(currentApp))
  const hasPendingAppChangesRef = useRef(false)
  const isIconDirtyRef = useRef(false)
  useEffect(() => {
    setDraft(current => ({
      appName: hasPendingAppChangesRef.current ? current.appName : currentApp.name,
      inactivityTimeoutSeconds: hasPendingAppChangesRef.current
        ? current.inactivityTimeoutSeconds
        : currentApp.inactivityTimeoutSeconds,
      memoryLimitMb: hasPendingAppChangesRef.current
        ? current.memoryLimitMb
        : (currentApp.memoryLimitMb?.toString() ?? ''),
      cpuLimitCpus: hasPendingAppChangesRef.current
        ? current.cpuLimitCpus
        : (currentApp.cpuLimitCpus?.toString() ?? ''),
      containerArgs: hasPendingAppChangesRef.current ? current.containerArgs : (currentApp.containerArgs ?? ''),
      icon: isIconDirtyRef.current ? current.icon : (currentApp.icon ?? null)
    }))
  }, [currentApp])

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

  const updateForm = useCallback((patch: Partial<AppFormValues>) => {
    hasPendingAppChangesRef.current = true
    setDraft(current => ({
      ...current,
      ...(patch.name !== undefined ? { appName: patch.name } : {}),
      ...(patch.inactivityTimeoutSeconds !== undefined
        ? { inactivityTimeoutSeconds: patch.inactivityTimeoutSeconds }
        : {}),
      ...(patch.memoryLimitMb !== undefined ? { memoryLimitMb: patch.memoryLimitMb } : {}),
      ...(patch.cpuLimitCpus !== undefined ? { cpuLimitCpus: patch.cpuLimitCpus } : {}),
      ...(patch.customContainerArgs !== undefined ? { containerArgs: patch.customContainerArgs } : {})
    }))
  }, [])

  const updateIcon = useCallback((nextIcon: string | null, isDirty: boolean) => {
    isIconDirtyRef.current = isDirty
    setDraft(current => ({ ...current, icon: nextIcon }))
  }, [])

  const markSaved = () => {
    hasPendingAppChangesRef.current = false
  }

  return {
    displayApp: { ...currentApp, name: draft.appName, icon: draft.icon },
    draft,
    formValues,
    markSaved,
    updateForm,
    updateIcon
  }
}
