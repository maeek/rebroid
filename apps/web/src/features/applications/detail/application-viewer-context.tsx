'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import type { Dispatch, ReactNode, SetStateAction } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AppDefinition } from '@/features/applications/domain/app-definition'
import { mergeApplicationDetailRefresh } from '@/features/applications/domain/app-mapper'
import { getAppRefreshIntervalMs } from '@/features/applications/domain/refresh'
import {
  useStartupFirstFrame,
  type ViewerStartupDurations
} from '@/features/applications/viewer/diagnostics/use-startup-first-frame'
import {
  loadViewerSettings,
  saveViewerSettings,
  viewerSettingsFromDefaults,
  viewerSettingsStorageKey
} from '@/features/applications/viewer/settings/viewer-settings'
import { getBff } from '@/lib/http/bff'
import { rememberRecentAppAction } from '@/server/recent-apps/actions'
import { ActionResultError } from '@/shared/actions/action-result'
import { notifyRecentAppsUpdated } from '@/shared/model/recent-apps/recent-apps'
import { hasPermission } from '@/shared/permissions/permissions'
import type { ViewerSettings } from '@/features/applications/viewer/settings/viewer-settings'
import type { ApplicationDetailRefresh } from '@/shared/contracts/application'
import type { OrchestratorUiSettings } from '@/shared/model/settings/orchestrator-ui-settings'
import type { PermissionMap } from '@/shared/permissions/permissions'
import type { ViewerStreamMetricsV4, ViewerFrameObservation } from '@rebroid/android-application-core/viewer-stream'

type ApplicationViewerContextValue = {
  app?: AppDefinition
  startupFirstFrameAt?: number
  viewerStartup?: ViewerStartupDurations
  recordStartupFirstFrame?: (observation?: ViewerFrameObservation, requestAt?: number) => void
  canAttach: boolean
  canCaptureScreenshot: boolean
  canControlViewer: boolean
  canViewInfrastructure: boolean
  canViewAuditActivity: boolean
  canStartCurrentApp: boolean
  initialSettings: OrchestratorUiSettings
  isForeignOwnedApp: boolean
  permissions: PermissionMap
  setApp: Dispatch<SetStateAction<AppDefinition | undefined>>
  setViewerStreamMetrics: Dispatch<SetStateAction<Record<string, ViewerStreamSample | undefined>>>
  setViewerSettings: Dispatch<SetStateAction<ViewerSettings>>
  viewerStreamMetrics: Record<string, ViewerStreamSample | undefined>
  viewerSettings: ViewerSettings
  viewerSettingsHydrated?: boolean
}

export type ViewerStreamSample = {
  sessionId: string
  runtimeId: string | null
  metrics: ViewerStreamMetricsV4
}

export const ApplicationViewerContext = createContext<ApplicationViewerContextValue | null>(null)

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

const detailAccessLost = (error: unknown) =>
  error instanceof ActionResultError && ['unauthenticated', 'forbidden', 'not_found'].includes(error.failure.code)

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
  const [viewerStreamMetrics, setViewerStreamMetrics] = useState<Record<string, ViewerStreamSample | undefined>>({})
  const [viewerSettingsHydrated, setViewerSettingsHydrated] = useState(false)
  const {
    firstFrameAt: startupFirstFrameAt,
    viewerStartup,
    recordFirstFrame: recordStartupFirstFrame
  } = useStartupFirstFrame(currentApp)
  const currentAppId = currentApp?.id
  const refreshIntervalMs = getAppRefreshIntervalMs(currentApp)
  const isForeignOwnedApp = Boolean(isAdmin && currentApp && currentApp.ownerUserId !== currentOwnerUserId)
  const canStartCurrentApp = !isForeignOwnedApp && hasPermission(permissions, 'applications:start')
  const canCaptureScreenshot = !isForeignOwnedApp && hasPermission(permissions, 'applications:capture-screenshot')
  const canControlViewer = !isForeignOwnedApp && hasPermission(permissions, 'applications:control-viewer')

  useEffect(() => {
    setCurrentApp(current => {
      if (app && current?.id === app.id && current.updatedAt > app.updatedAt) return current
      return app
    })
  }, [app])

  useEffect(() => {
    setViewerStreamMetrics({})
  }, [currentApp?.id, currentApp?.containerId])

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

  const { data: refreshedApp, error } = useQuery({
    queryKey: ['application-detail', currentOwnerUserId, currentAppId],
    queryFn: async ({ signal }) => {
      const revision = currentApp?.detailRevision
      const query = revision ? `?${new URLSearchParams({ revision })}` : ''
      const result = await getBff<ApplicationDetailRefresh>(
        `/api/bff/devices/${encodeURIComponent(currentAppId!)}/detail${query}`,
        signal
      )
      return { ...result, revision }
    },
    initialData: { app: null, state: null, revision: undefined },
    enabled: Boolean(currentAppId),
    refetchOnMount: false,
    refetchInterval: refreshIntervalMs ?? false,
    gcTime: 0,
    retry: (count, failure) => count < 2 && !detailAccessLost(failure)
  })

  useEffect(() => {
    if (detailAccessLost(error)) {
      setCurrentApp(current => (current?.id === currentAppId ? undefined : current))
      return
    }
    if (!refreshedApp) {
      return
    }

    setCurrentApp(current => {
      if (!current || current.id !== currentAppId) return current
      return mergeApplicationDetailRefresh(current, refreshedApp, refreshedApp.revision)
    })
  }, [currentAppId, error, refreshedApp])

  return (
    <ApplicationViewerContext.Provider
      value={{
        app: currentApp,
        startupFirstFrameAt,
        viewerStartup,
        recordStartupFirstFrame,
        canAttach: !isForeignOwnedApp,
        canCaptureScreenshot,
        canControlViewer,
        canStartCurrentApp,
        canViewInfrastructure: isAdmin,
        canViewAuditActivity: isAdmin,
        initialSettings,
        isForeignOwnedApp,
        permissions,
        setApp: setCurrentApp,
        setViewerStreamMetrics,
        viewerStreamMetrics,
        setViewerSettings,
        viewerSettingsHydrated,
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
