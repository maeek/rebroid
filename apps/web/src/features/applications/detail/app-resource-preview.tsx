'use client'

import { useState, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useSearchParams } from 'next/navigation'
import { AppManage } from '@/features/applications/manage/app-manage'
import { DisplayViewerProvider } from '@/features/applications/viewer/display/display-viewer-shell/display-viewer-context'
import { DisplayViewerShell } from '@/features/applications/viewer/display/display-viewer-shell/display-viewer-shell'
import { ViewerClipboard } from '@/features/applications/viewer/display/display-viewer-shell/surface/viewer-clipboard'
import { viewerSettingsFromDefaults } from '@/features/applications/viewer/settings/viewer-settings'
import { AiAgentPreview } from '@/features/applications/viewer/tools/runtime-tools-panel/ai-agent/ai-agent-preview'
import { DownloadsToolsSection } from '@/features/applications/viewer/tools/runtime-tools-panel/files/downloads-tools-section'
import { RuntimeToolPanelLayout } from '@/features/applications/viewer/tools/runtime-tools-panel/runtime-tools-panel'
import { FeatureFlagsProvider } from '@/shared/model/features/feature-flags-context'
import { defaultOrchestratorUiSettings } from '@/shared/model/settings/orchestrator-ui-settings'
import { fullPermissions } from '@/shared/permissions/permissions'
import { AppDeviceLayout } from './app-device-layout'
import { AppResourceBreadcrumbs } from './app-resource-breadcrumbs'
import { AppResourceHome } from './app-resource-home'
import { previewApp } from './app-resource-preview-data'
import { AppViewerPane } from './app-viewer-pane'
import { AppWorkspaceLayout } from './app-workspace-content'
import { ApplicationViewerContext } from './application-viewer-context'
import type { AppDefinition } from '@/features/applications/domain/app-definition'
import type { DisplayViewerStreamMetrics } from '@/features/applications/viewer/display/display-viewer-stream-status'

const previewDisplay = {
  applicationId: previewApp.id,
  canCaptureScreenshot: false,
  canControl: false,
  controlsEnabled: false,
  initialKeyboardCaptureEnabled: false,
  surfaces: [
    {
      id: 'preview-display',
      surfaceId: 'preview-display',
      sessionId: 'preview-session',
      kind: 'main' as const,
      name: 'Main display',
      src: '/preview-display-frame',
      popoutUrl: '/preview-display-frame',
      displaySize: { width: 1280, height: 720 }
    }
  ]
}

/** Static context keeps the gated visual fixture free of authenticated background requests. */
export const AppResourcePreview = ({ activity, agent = false }: { activity?: ReactNode; agent?: boolean }) => {
  const [queryClient] = useState(() => {
    const client = new QueryClient({
      defaultOptions: { queries: { staleTime: Infinity, refetchOnWindowFocus: false } }
    })
    for (const source of ['orchestrator', 'container', 'adb']) {
      client.setQueryData(['polling-query', JSON.stringify(['applications', previewApp.id, 'logs', source])], {
        source,
        collectedAt: '2026-11-07T10:00:00Z',
        output: ''
      })
    }
    return client
  })
  const [app, setApp] = useState<AppDefinition | undefined>(previewApp)
  const [viewerSettings, setViewerSettings] = useState(() => viewerSettingsFromDefaults(defaultOrchestratorUiSettings))
  const [viewerStreamMetrics, setViewerStreamMetrics] = useState<
    Record<string, DisplayViewerStreamMetrics | undefined>
  >({})
  const search = useSearchParams()
  const selected = search.get('view')
  const previewLiveViewer = search.get('viewer') === 'preview'
  const view = selected === 'activity' || selected === 'diagnostics' ? selected : 'overview'
  const showAgent = agent && (selected === null || selected === 'ai-agent')
  const breadcrumbView = showAgent ? 'ai-agent' : selected === 'configuration' || selected === 'files' ? selected : view
  return (
    <QueryClientProvider client={queryClient}>
      <ApplicationViewerContext.Provider
        value={{
          app,
          setApp,
          permissions: fullPermissions,
          initialSettings: defaultOrchestratorUiSettings,
          isForeignOwnedApp: false,
          canAttach: true,
          canCaptureScreenshot: true,
          canControlViewer: true,
          canViewInfrastructure: true,
          canViewAuditActivity: true,
          canStartCurrentApp: true,
          viewerSettings,
          setViewerSettings,
          viewerStreamMetrics,
          setViewerStreamMetrics
        }}
      >
        <main
          tabIndex={-1}
          className={
            agent
              ? 'main-layout min-h-screen bg-background pt-(--console-top-inset) lg:pl-72'
              : 'min-h-screen bg-background pt-(--console-top-inset)'
          }
        >
          <AppDeviceLayout
            breadcrumbs={
              <AppResourceBreadcrumbs
                appId={previewApp.id}
                appName={previewApp.name}
                view={breadcrumbView}
              />
            }
            viewer={
              previewLiveViewer ? (
                <FeatureFlagsProvider manifest={{ revision: 1, features: [] }}>
                  <DisplayViewerProvider value={previewDisplay}>
                    <DisplayViewerShell
                      className='h-[var(--app-viewer-height)]'
                      clipboard={<ViewerClipboard appId={previewApp.id} />}
                      miniPlayerEnabled
                    />
                  </DisplayViewerProvider>
                </FeatureFlagsProvider>
              ) : (
                <AppViewerPane placement='top' />
              )
            }
            contained={showAgent}
          >
            {showAgent ? (
              <AppWorkspaceLayout toolId='ai-agent'>
                <RuntimeToolPanelLayout toolId='ai-agent'>
                  <AiAgentPreview />
                </RuntimeToolPanelLayout>
              </AppWorkspaceLayout>
            ) : selected === 'configuration' ? (
              <AppManage />
            ) : selected === 'files' ? (
              <AppWorkspaceLayout toolId='files'>
                <RuntimeToolPanelLayout toolId='files'>
                  <DownloadsToolsSection
                    app={{ ...previewApp, status: 'running', running: true }}
                    permissions={fullPermissions}
                  />
                </RuntimeToolPanelLayout>
              </AppWorkspaceLayout>
            ) : (
              <AppResourceHome
                view={view}
                activity={activity}
              />
            )}
          </AppDeviceLayout>
        </main>
      </ApplicationViewerContext.Provider>
    </QueryClientProvider>
  )
}
