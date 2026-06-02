'use client'
import { useEffect, useState } from 'react'
import { AppNotFoundSplash } from '@/features/applications/components/app-not-found-splash'
import { AppDefinition } from '@/features/applications/domain/app-definition'
import { mapAndroidApplicationToAppDefinition } from '@/features/applications/domain/app-mapper'
import { getAppRefreshIntervalMs } from '@/features/applications/domain/refresh'
import { resolveAppIconUrl } from '@/features/applications/icons/url'
import { notifyRecentAppsUpdated } from '@/features/applications/recent/recent-apps'
import {
  loadViewerSettings,
  saveViewerSettings,
  viewerSettingsStorageKey,
  viewerSettingsFromDefaults
} from '@/features/applications/viewer/viewer-settings'
import { ProtectedSplitPageLayout, ProtectedStackPageLayout } from '@/features/shell/components/protected-page-shell'
import { usePollingQuery } from '@/hooks/use-polling-query'
import { getApplicationAction } from '@/server/orchestrator/applications/actions/queries/get-application-action'
import { rememberRecentAppAction } from '@/server/recent-apps/actions'
import { hasPermission } from '@/shared/permissions/permissions'
import { PageBackdrop } from '../../shell/components/page-backdrop'
import { AppViewerContent } from './app-viewer-content'
import { AppViewerPane } from './app-viewer-pane'
import { AppWorkspaceContent } from './app-workspace-content'
import type { OrchestratorUiSettings } from '@/features/settings/hooks/use-orchestrator-ui-settings'
import type { PermissionMap } from '@/shared/permissions/permissions'

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

export const AppViewerPage = ({
  app,
  permissions,
  initialSettings,
  currentOwnerUserId,
  isAdmin,
  viewMode = 'workspace'
}: {
  app?: AppDefinition
  permissions: PermissionMap
  initialSettings: OrchestratorUiSettings
  currentOwnerUserId: string
  isAdmin: boolean
  viewMode?: 'workspace' | 'details'
}) => {
  const [currentApp, setCurrentApp] = useState(app)
  const [viewerSettings, setViewerSettings] = useState(() => viewerSettingsFromDefaults(initialSettings))
  const [viewerSettingsHydrated, setViewerSettingsHydrated] = useState(false)
  const currentAppId = currentApp?.id
  const refreshIntervalMs = getAppRefreshIntervalMs(currentApp)
  const isForeignOwnedApp = Boolean(isAdmin && currentApp && currentApp.ownerUserId !== currentOwnerUserId)
  const isDetailsView = viewMode === 'details'
  const canStartCurrentApp = !isForeignOwnedApp && hasPermission(permissions, 'applications:start')
  const canCaptureScreenshot = !isForeignOwnedApp && hasPermission(permissions, 'applications:capture-screenshot')
  const canControlViewer = !isForeignOwnedApp && hasPermission(permissions, 'applications:control-viewer')

  useEffect(() => {
    setCurrentApp(app)
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
    if (currentApp) {
      void rememberRecentAppAction(currentApp.id)
        .then(notifyRecentAppsUpdated)
        .catch(() => undefined)
    }
  }, [currentApp?.id])

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

  if (!currentApp) {
    return <AppNotFoundSplash />
  }

  if (!isDetailsView) {
    return (
      <ProtectedStackPageLayout
        className='h-auto min-h-[calc(100vh-4rem)]'
        mainClassName='min-h-[calc(100vh-4rem)] items-stretch'
      >
        <PageBackdrop
          imageSrc={currentApp.icon ? resolveAppIconUrl(currentApp.icon) : null}
          opacity={0.08}
        />
        <AppWorkspaceContent
          app={currentApp}
          initialSettings={initialSettings}
          permissions={permissions}
          isForeignOwnedApp={isForeignOwnedApp}
          viewerSettings={viewerSettings}
          onAppChange={setCurrentApp}
          onViewerSettingsChange={setViewerSettings}
          viewerSlot={
            <AppViewerPane
              app={currentApp}
              canAttach={!isForeignOwnedApp}
              canCaptureScreenshot={canCaptureScreenshot}
              canControlViewer={canControlViewer}
              canStart={canStartCurrentApp}
              placement='top'
              viewerSettings={viewerSettings}
              onAppChange={setCurrentApp}
              onViewerSettingsChange={setViewerSettings}
            />
          }
        />
      </ProtectedStackPageLayout>
    )
  }

  return (
    <ProtectedSplitPageLayout
      className='h-auto min-h-[calc(100vh-4rem)]'
      mainClassName='h-auto min-h-[calc(100vh-4rem)] items-start'
    >
      <PageBackdrop
        imageSrc={currentApp.icon ? resolveAppIconUrl(currentApp.icon) : null}
        opacity={0.08}
      />
      <AppViewerContent
        app={currentApp}
        initialSettings={initialSettings}
        permissions={permissions}
        isForeignOwnedApp={isForeignOwnedApp}
        onAppChange={nextApp => setCurrentApp(nextApp)}
      />
      <AppViewerPane
        app={currentApp}
        canAttach={!isForeignOwnedApp}
        canCaptureScreenshot={canCaptureScreenshot}
        canControlViewer={canControlViewer}
        canStart={canStartCurrentApp}
        viewerSettings={viewerSettings}
        onAppChange={setCurrentApp}
        onViewerSettingsChange={setViewerSettings}
      />
    </ProtectedSplitPageLayout>
  )
}
