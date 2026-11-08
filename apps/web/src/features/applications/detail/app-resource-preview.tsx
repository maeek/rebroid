'use client'

import { useState, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useSearchParams } from 'next/navigation'
import { viewerSettingsFromDefaults } from '@/features/applications/viewer/settings/viewer-settings'
import { AiAgentPreview } from '@/features/applications/viewer/tools/runtime-tools-panel/ai-agent/ai-agent-preview'
import { RuntimeToolPanelLayout } from '@/features/applications/viewer/tools/runtime-tools-panel/runtime-tools-panel'
import { defaultOrchestratorUiSettings } from '@/shared/model/settings/orchestrator-ui-settings'
import { fullPermissions } from '@/shared/permissions/permissions'
import { AppDeviceLayout } from './app-device-layout'
import { AppResourceHome } from './app-resource-home'
import { previewApp } from './app-resource-preview-data'
import { AppViewerPane } from './app-viewer-pane'
import { AppWorkspaceLayout } from './app-workspace-content'
import { ApplicationViewerContext } from './application-viewer-context'
import type { AppDefinition } from '@/features/applications/domain/app-definition'
import type { DisplayViewerStreamMetrics } from '@/features/applications/viewer/display/display-viewer-stream-status'

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
  const selected = useSearchParams().get('view')
  const view = selected === 'activity' || selected === 'diagnostics' ? selected : 'overview'
  const showAgent = agent && (selected === null || selected === 'ai-agent')
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
        <main className={agent ? 'min-h-screen bg-background pt-16 lg:pl-72' : 'min-h-screen bg-background pt-16'}>
          <AppDeviceLayout
            viewer={<AppViewerPane placement='top' />}
            contained={showAgent}
          >
            {showAgent ? (
              <AppWorkspaceLayout toolId='ai-agent'>
                <RuntimeToolPanelLayout toolId='ai-agent'>
                  <AiAgentPreview />
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
