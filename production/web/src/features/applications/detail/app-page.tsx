'use client'
import { useEffect, useState } from 'react'
import { IconDeviceMobileQuestion } from '@tabler/icons-react'
import { AppDefinition } from '@/features/applications/domain/app-definition'
import { mapAndroidApplicationToAppDefinition } from '@/features/applications/domain/app-mapper'
import { getAppRefreshIntervalMs } from '@/features/applications/domain/refresh'
import { resolveAppIconUrl } from '@/features/applications/icons/url'
import { rememberRecentApp } from '@/features/applications/recent/recent-apps'
import {
  defaultViewerSettings,
  loadViewerSettings,
  saveViewerSettings
} from '@/features/applications/viewer/viewer-settings'
import { ProtectedSplitPageLayout } from '@/features/shell/components/protected-page-shell'
import { StatusSplash } from '@/features/shell/components/status-splash'
import { useForegroundRefresh } from '@/hooks/use-foreground-refresh'
import { getApplicationAction } from '@/server/orchestrator/applications/read-actions'
import { hasPermission } from '@/shared/permissions/permissions'
import { PageBackdrop } from '../../shell/components/page-backdrop'
import { AppViewerContent } from './app-viewer-content'
import { AppViewerPane } from './app-viewer-pane'
import { AppWorkspaceContent } from './app-workspace-content'
import type { OrchestratorUiSettings } from '@/features/settings/hooks/use-orchestrator-ui-settings'
import type { PermissionMap } from '@/shared/permissions/permissions'

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
  const [viewerSettings, setViewerSettings] = useState(defaultViewerSettings)
  const currentAppId = currentApp?.id
  const refreshIntervalMs = getAppRefreshIntervalMs(currentApp)
  const isForeignOwnedApp = Boolean(isAdmin && currentApp && currentApp.ownerUserId !== currentOwnerUserId)
  const isDetailsView = viewMode === 'details'
  const canStartCurrentApp = !isForeignOwnedApp && hasPermission(permissions, 'applications:start')
  const canCaptureScreenshot = !isForeignOwnedApp && hasPermission(permissions, 'applications:capture-screenshot')

  useEffect(() => {
    setCurrentApp(app)
  }, [app])

  useEffect(() => {
    setViewerSettings(loadViewerSettings())
  }, [])

  useEffect(() => {
    saveViewerSettings(viewerSettings)
  }, [viewerSettings])

  useEffect(() => {
    if (currentApp) {
      rememberRecentApp(currentApp)
    }
  }, [currentApp])

  useForegroundRefresh({
    enabled: Boolean(currentAppId),
    intervalMs: refreshIntervalMs,
    refresh: async () => {
      if (!currentAppId) {
        return
      }

      try {
        const nextApp = await getApplicationAction(currentAppId)
        setCurrentApp(current => {
          const mapped = mapAndroidApplicationToAppDefinition(nextApp)
          return {
            ...mapped,
            icon: current?.icon ?? mapped.icon,
            ownerDisplayName: current?.ownerDisplayName ?? mapped.ownerDisplayName
          }
        })
      } catch {
        // Keep the last known app state on transient refresh failures.
      }
    }
  })

  if (!currentApp) {
    return (
      <div className='pl-72 max-lg:pl-0'>
        <section className='px-6 py-8 max-sm:px-4'>
          <StatusSplash
            title='App not found'
            description='This Android app may have been deleted, or your account may not have access to it.'
            icon={<IconDeviceMobileQuestion className='size-10' />}
            primaryAction={{ label: 'Refresh', onClick: () => window.location.reload() }}
            secondaryAction={{ label: 'Back to apps', href: '/apps' }}
          />
        </section>
      </div>
    )
  }

  return (
    <ProtectedSplitPageLayout
      className='h-auto min-h-[calc(100vh-4rem)]'
      mainClassName='h-auto min-h-[calc(100vh-4rem)] items-start'
    >
      <PageBackdrop imageSrc={currentApp.icon ? resolveAppIconUrl(currentApp.icon) : null} />
      {isDetailsView ? (
        <AppViewerContent
          app={currentApp}
          initialSettings={initialSettings}
          permissions={permissions}
          isForeignOwnedApp={isForeignOwnedApp}
          onAppChange={nextApp => setCurrentApp(nextApp)}
        />
      ) : (
        <AppWorkspaceContent
          app={currentApp}
          initialSettings={initialSettings}
          permissions={permissions}
          isForeignOwnedApp={isForeignOwnedApp}
          viewerSettings={viewerSettings}
          onViewerSettingsChange={setViewerSettings}
        />
      )}
      <AppViewerPane
        app={currentApp}
        canAttach={!isForeignOwnedApp}
        canCaptureScreenshot={canCaptureScreenshot}
        canStart={canStartCurrentApp}
        viewerSettings={viewerSettings}
        onAppChange={setCurrentApp}
      />
    </ProtectedSplitPageLayout>
  )
}
