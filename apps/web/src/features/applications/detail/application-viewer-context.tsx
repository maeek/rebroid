'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import type { Dispatch, ReactNode, SetStateAction } from 'react'
import { AppDefinition } from '@/features/applications/domain/app-definition'
import { mapAndroidApplicationToAppDefinition } from '@/features/applications/domain/app-mapper'
import { getAppRefreshIntervalMs } from '@/features/applications/domain/refresh'
import {
  loadViewerSettings,
  saveViewerSettings,
  viewerSettingsFromDefaults,
  viewerSettingsStorageKey
} from '@/features/applications/viewer/settings/viewer-settings'
import { usePollingQuery } from '@/hooks/use-polling-query'
import { getApplicationAction } from '@/server/orchestrator/applications/actions/queries/get-application-action'
import { rememberRecentAppAction } from '@/server/recent-apps/actions'
import { notifyRecentAppsUpdated } from '@/shared/model/recent-apps/recent-apps'
import { hasPermission } from '@/shared/permissions/permissions'
import type { DisplayViewerStreamMetrics } from '@/features/applications/viewer/display/display-viewer-stream-status'
import type { ViewerSettings } from '@/features/applications/viewer/settings/viewer-settings'
import type { OrchestratorUiSettings } from '@/shared/model/settings/use-orchestrator-ui-settings'
import type { PermissionMap } from '@/shared/permissions/permissions'

type ApplicationViewerContextValue = {
  app?: AppDefinition
  canAttach: boolean
  canCaptureScreenshot: boolean
  canControlViewer: boolean
  canStartCurrentApp: boolean
  initialSettings: OrchestratorUiSettings
  isForeignOwnedApp: boolean
  permissions: PermissionMap
  setApp: Dispatch<SetStateAction<AppDefinition | undefined>>
  setViewerStreamMetrics: Dispatch<SetStateAction<Record<string, DisplayViewerStreamMetrics | undefined>>>
  setViewerSettings: Dispatch<SetStateAction<ViewerSettings>>
  viewerStreamMetrics: Record<string, DisplayViewerStreamMetrics | undefined>
  viewerSettings: ViewerSettings
}

const ApplicationViewerContext = createContext<ApplicationViewerContextValue | null>(null)

const isEditableElement = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.isContentEditable
  )
}

export const ApplicationViewerProvider = ({
  app,
  children,
  currentOwnerUserId,
  initialSettings,
  isAdmin,
  permissions
}: {
  app?: AppDefinition
  children: ReactNode
  currentOwnerUserId: string
  initialSettings: OrchestratorUiSettings
  isAdmin: boolean
  permissions: PermissionMap
}) => {
  const [currentApp, setCurrentApp] = useState(app)
  const [viewerSettings, setViewerSettings] = useState(() => viewerSettingsFromDefaults(initialSettings))
  const [viewerStreamMetrics, setViewerStreamMetrics] = useState<
    Record<string, DisplayViewerStreamMetrics | undefined>
  >({})
  const [viewerSettingsHydrated, setViewerSettingsHydrated] = useState(false)
  const currentAppId = currentApp?.id
  const refreshIntervalMs = getAppRefreshIntervalMs(currentApp)
  const isForeignOwnedApp = Boolean(isAdmin && currentApp && currentApp.ownerUserId !== currentOwnerUserId)
  const canStartCurrentApp = !isForeignOwnedApp && hasPermission(permissions, 'applications:start')
  const canCaptureScreenshot = !isForeignOwnedApp && hasPermission(permissions, 'applications:capture-screenshot')
  const canControlViewer = !isForeignOwnedApp && hasPermission(permissions, 'applications:control-viewer')

  useEffect(() => {
    setCurrentApp(app)
    setViewerStreamMetrics({})
  }, [app])

  useEffect(() => {
    const hasStoredSettings = window.localStorage.getItem(viewerSettingsStorageKey) !== null
    setViewerSettings(hasStoredSettings ? loadViewerSettings() : viewerSettingsFromDefaults(initialSettings))
    setViewerSettingsHydrated(true)
  }, [initialSettings])

  useEffect(() => {
    if (!viewerSettingsHydrated) {
      return
    }

    saveViewerSettings(viewerSettings)
  }, [viewerSettings, viewerSettingsHydrated])

  useEffect(() => {
    if (currentAppId) {
      void rememberRecentAppAction(currentAppId)
        .then(notifyRecentAppsUpdated)
        .catch(() => undefined)
    }
  }, [currentAppId])

  useEffect(() => {
    const blurFocusedEditorOutsideEditableTarget = (target: EventTarget | null) => {
      const activeElement = document.activeElement
      if (!(activeElement instanceof HTMLElement) || !isEditableElement(activeElement) || isEditableElement(target)) {
        return false
      }

      activeElement.blur()
      return true
    }

    const handlePointerDown = (event: PointerEvent) => {
      blurFocusedEditorOutsideEditableTarget(event.target)
    }

    const handleContextMenu = (event: MouseEvent) => {
      if (blurFocusedEditorOutsideEditableTarget(event.target)) {
        event.preventDefault()
      }
    }

    document.addEventListener('pointerdown', handlePointerDown, true)
    document.addEventListener('contextmenu', handleContextMenu, true)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true)
      document.removeEventListener('contextmenu', handleContextMenu, true)
    }
  }, [])

  const { data: refreshedApp } = usePollingQuery(
    ['applications', currentAppId],
    () => getApplicationAction(currentAppId!),
    {
      enabled: Boolean(currentAppId),
      intervalMs: refreshIntervalMs
    }
  )

  useEffect(() => {
    if (!refreshedApp) {
      return
    }

    setCurrentApp(current => {
      const mapped = mapAndroidApplicationToAppDefinition(refreshedApp)
      return {
        ...mapped,
        icon: current?.icon ?? mapped.icon,
        ownerDisplayName: current?.ownerDisplayName ?? mapped.ownerDisplayName
      }
    })
  }, [refreshedApp])

  return (
    <ApplicationViewerContext.Provider
      value={{
        app: currentApp,
        canAttach: !isForeignOwnedApp,
        canCaptureScreenshot,
        canControlViewer,
        canStartCurrentApp,
        initialSettings,
        isForeignOwnedApp,
        permissions,
        setApp: setCurrentApp,
        setViewerStreamMetrics,
        viewerStreamMetrics,
        setViewerSettings,
        viewerSettings
      }}
    >
      {children}
    </ApplicationViewerContext.Provider>
  )
}

export const useApplicationViewerContext = () => {
  const context = useContext(ApplicationViewerContext)

  if (!context) {
    throw new Error('useApplicationViewerContext must be used within ApplicationViewerProvider')
  }

  return context
}

export const useApplicationViewerApp = () => {
  const context = useApplicationViewerContext()

  if (!context.app) {
    throw new Error('useApplicationViewerApp requires an available application')
  }

  return { ...context, app: context.app }
}
