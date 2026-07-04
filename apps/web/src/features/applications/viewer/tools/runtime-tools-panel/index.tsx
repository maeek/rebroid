'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useApplicationViewerApp } from '@/features/applications/detail/application-viewer-context'
import { cn } from '@/lib/utils'
import { RuntimeToolContent } from './runtime-tool-content'
import { getRuntimeTools, runtimeToolPanelClassName, type RuntimeToolId } from './runtime-tool-definitions'
import { RuntimeToolTabs } from './runtime-tool-tabs'
import type { AutomationRun } from '@/server/orchestrator/automations/types'

export const RuntimeToolsPanel = () => {
  const router = useRouter()
  const { app, initialSettings, permissions, setApp, setViewerSettings, viewerSettings, viewerStreamMetrics } =
    useApplicationViewerApp()
  const [latestAutomationRun, setLatestAutomationRun] = useState<AutomationRun | null>(null)
  const latestStreamMetrics = useMemo(
    () =>
      Object.values(viewerStreamMetrics)
        .filter((metrics): metrics is NonNullable<typeof metrics> => Boolean(metrics))
        .sort((left, right) => right.collectedAt - left.collectedAt)[0] ?? null,
    [viewerStreamMetrics]
  )
  const tools = useMemo(
    () => getRuntimeTools({ app, latestAutomationRun, permissions, viewerSettings }),
    [app, latestAutomationRun, permissions, viewerSettings]
  )
  const [activeTool, setActiveTool] = useState<RuntimeToolId | null>(() => tools[0]?.id ?? 'streaming')
  const activeToolIsAvailable = tools.some(tool => tool.id === activeTool)
  const selectedToolId = activeToolIsAvailable ? activeTool : (tools[0]?.id ?? null)

  useEffect(() => {
    if (!selectedToolId || selectedToolId === activeTool) return
    setActiveTool(selectedToolId)
  }, [activeTool, selectedToolId])

  return (
    <div className='flex min-h-0 w-full flex-1 flex-col gap-4 max-sm:px-4'>
      <div className='flex min-h-0 flex-1 flex-col overflow-hidden'>
        <RuntimeToolTabs
          tools={tools}
          selectedToolId={selectedToolId}
          onSelectTool={setActiveTool}
        />
        <div
          id={selectedToolId ? `runtime-tool-panel-${selectedToolId}` : undefined}
          role='tabpanel'
          aria-labelledby={selectedToolId ? `runtime-tool-tab-${selectedToolId}` : undefined}
          className={cn('min-h-0 py-4', runtimeToolPanelClassName(selectedToolId))}
        >
          {selectedToolId ? (
            <RuntimeToolContent
              app={app}
              initialAiContextualSuggestionsEnabled={initialSettings.aiContextualSuggestionsEnabled}
              latestAutomationRun={latestAutomationRun}
              latestStreamMetrics={latestStreamMetrics}
              onAppChange={setApp}
              onOpenWorkflowDraft={() => router.push('/automations/create')}
              onRunStarted={setLatestAutomationRun}
              onToolSelected={setActiveTool}
              onViewerSettingsChange={setViewerSettings}
              permissions={permissions}
              toolId={selectedToolId}
              viewerSettings={viewerSettings}
            />
          ) : null}
        </div>
      </div>
    </div>
  )
}
