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

export const useAppManageDraft = (app?: AppDefinition) => {
  const [currentApp, setCurrentApp] = useState(app)
  const [draft, setDraft] = useState(() => draftFromApp(app))
  const hasPendingAppChangesRef = useRef(false)
  const isIconDirtyRef = useRef(false)
  const previousAppIdRef = useRef(app?.id)

  useEffect(() => {
    if (app?.id !== previousAppIdRef.current) {
      previousAppIdRef.current = app?.id
      hasPendingAppChangesRef.current = false
      isIconDirtyRef.current = false
      setDraft(draftFromApp(app))
    }

    setCurrentApp(current => {
      if (!app) return app
      if (app.id !== current?.id) return app
      return mergeAppPreservingDraftAssets(app, current)
    })
  }, [app])

  useEffect(() => {
    if (!currentApp) return
    setDraft(current => ({
      appName: hasPendingAppChangesRef.current ? current.appName : currentApp.name,
      inactivityTimeoutSeconds: hasPendingAppChangesRef.current
        ? current.inactivityTimeoutSeconds
        : currentApp.inactivityTimeoutSeconds,
      memoryLimitMb: hasPendingAppChangesRef.current ? current.memoryLimitMb : currentApp.memoryLimitMb?.toString() ?? '',
      cpuLimitCpus: hasPendingAppChangesRef.current ? current.cpuLimitCpus : currentApp.cpuLimitCpus?.toString() ?? '',
      containerArgs: hasPendingAppChangesRef.current ? current.containerArgs : currentApp.containerArgs ?? '',
      icon: isIconDirtyRef.current ? current.icon : currentApp.icon ?? null
    }))
  }, [currentApp])

  const formValues = (currentApp
    ? {
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
      }
    : null) satisfies AppFormValues | null

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

  const mergeRefreshedApp = useCallback((nextApp: AppDefinition) => {
    setCurrentApp(current => mergeAppPreservingDraftAssets(nextApp, current))
  }, [])

  const markSaved = useCallback((nextApp: AppDefinition) => {
    hasPendingAppChangesRef.current = false
    setCurrentApp(current => mergeAppPreservingDraftAssets(nextApp, current))
  }, [])

  return {
    currentApp,
    displayApp: currentApp ? { ...currentApp, name: draft.appName, icon: draft.icon } : null,
    draft,
    formValues,
    markSaved,
    mergeRefreshedApp,
    setCurrentApp,
    updateForm,
    updateIcon
  }
}
