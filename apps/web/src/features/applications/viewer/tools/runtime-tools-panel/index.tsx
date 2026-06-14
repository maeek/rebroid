'use client'

import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import { IconCast, IconClipboard, IconFolder, IconLogs, IconRobot, IconWorld } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { GradientSparklesIcon } from '@/components/icons/gradient-sparkles-icon'
import { useApplicationViewerApp } from '@/features/applications/detail/application-viewer-context'
import { AppLogsContent } from '@/features/applications/viewer/logs/app-logs-content'
import { cn } from '@/lib/utils'
import { draftWorkflowFromAdHocRunAction } from '@/server/orchestrator/automations/automation-management-actions'
import { hasPermission } from '@/shared/permissions/permissions'
import { AiAgentToolsSection } from './ai-agent-tools-section'
import { AutomationStatusToolsSection } from './automation-status-tools-section'
import { ClipboardToolsSection } from './clipboard-tools-section'
import { DownloadsToolsSection } from './downloads-tools-section'
import { NetworkAccessToolsSection } from './network-access-tools-section'
import { StreamingToolsSection } from './streaming-tools-section'
import type { AutomationRun } from '@/server/orchestrator/automations/types'

type RuntimeToolId = 'clipboard' | 'files' | 'streaming' | 'network-access' | 'logs' | 'ai-agent' | 'automations'

export const RuntimeToolsPanel = () => {
  const router = useRouter()
  const { app, permissions, setApp, setViewerSettings, viewerSettings, viewerStreamMetrics } = useApplicationViewerApp()
  const [latestAutomationRun, setLatestAutomationRun] = useState<AutomationRun | null>(null)
  const latestStreamMetrics = useMemo(
    () =>
      Object.values(viewerStreamMetrics)
        .filter((metrics): metrics is NonNullable<typeof metrics> => Boolean(metrics))
        .sort((left, right) => right.collectedAt - left.collectedAt)[0] ?? null,
    [viewerStreamMetrics]
  )
  const tools = useMemo(
    () =>
      [
        hasPermission(permissions, 'automations:run') && hasPermission(permissions, 'automations:run-ai') && app.running
          ? {
              id: 'ai-agent' as const,
              title: 'AI agent',
              description: 'Run ad-hoc automation',
              Icon: GradientSparklesIcon
            }
          : null,
        hasPermission(permissions, 'automations:run')
          ? {
              id: 'automations' as const,
              title: 'Automations',
              description: latestAutomationRun ? `Run ${latestAutomationRun.id.slice(0, 8)}` : 'Active runs',
              Icon: IconRobot
            }
          : null,
        hasPermission(permissions, 'applications:sync-clipboard') && app.running
          ? {
              id: 'clipboard' as const,
              title: 'Clipboard',
              description: 'Pull or push text',
              Icon: IconClipboard
            }
          : null,
        {
          id: 'streaming' as const,
          title: 'Streaming',
          description: `${viewerSettings.transport.toUpperCase()} • ${viewerSettings.bitrateMbps} Mbps`,
          Icon: IconCast
        },
        hasPermission(permissions, 'applications:configure-egress')
          ? {
              id: 'network-access' as const,
              title: 'Network access',
              description: app.networkPolicyEnabled ? 'Restricted outbound access' : 'Unrestricted outbound access',
              Icon: IconWorld
            }
          : null,
        hasPermission(permissions, 'applications:transfer-files') && app.running
          ? {
              id: 'files' as const,
              title: 'Files',
              description: 'Upload and download files',
              Icon: IconFolder
            }
          : null,
        hasPermission(permissions, 'applications:view-logs') && app.running
          ? {
              id: 'logs' as const,
              title: 'Logs',
              description: 'View application logs',
              Icon: IconLogs
            }
          : null
      ].filter((tool): tool is NonNullable<typeof tool> => Boolean(tool)),
    [
      app.networkPolicyEnabled,
      app.running,
      latestAutomationRun,
      permissions,
      viewerSettings.bitrateMbps,
      viewerSettings.transport
    ]
  )
  const [activeTool, setActiveTool] = useState<RuntimeToolId | null>(() => tools[0]?.id ?? 'streaming')
  const activeToolIsAvailable = tools.some(tool => tool.id === activeTool)
  const selectedToolId = activeToolIsAvailable ? activeTool : (tools[0]?.id ?? null)

  useEffect(() => {
    if (!selectedToolId || selectedToolId === activeTool) return
    setActiveTool(selectedToolId)
  }, [activeTool, selectedToolId])

  const handleToolTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, toolId: RuntimeToolId) => {
    const currentIndex = tools.findIndex(tool => tool.id === toolId)
    if (currentIndex === -1) return

    const keyToIndex: Record<string, number> = {
      ArrowLeft: currentIndex - 1,
      ArrowRight: currentIndex + 1,
      Home: 0,
      End: tools.length - 1
    }
    const nextIndex = keyToIndex[event.key]

    if (nextIndex === undefined) return

    event.preventDefault()
    const nextTool = tools[(nextIndex + tools.length) % tools.length]
    setActiveTool(nextTool.id)
    document.getElementById(`runtime-tool-tab-${nextTool.id}`)?.focus()
  }

  const renderToolContent = (toolId: RuntimeToolId, inline = false) => {
    const sectionClassName = inline
      ? 'rounded-none border-0 bg-transparent p-0 shadow-none backdrop-blur-none'
      : undefined

    if (toolId === 'clipboard') {
      return (
        <ClipboardToolsSection
          app={app}
          permissions={permissions}
          className={cn(sectionClassName, inline && 'px-0')}
          hideHeader={inline}
        />
      )
    }

    if (toolId === 'files') {
      return (
        <DownloadsToolsSection
          app={app}
          permissions={permissions}
          className={cn(sectionClassName, inline && 'px-0')}
          hideHeader={inline}
        />
      )
    }

    if (toolId === 'logs') {
      return (
        <div className='min-h-30 max-h-300 overflow-auto'>
          <AppLogsContent app={app} />
        </div>
      )
    }

    if (toolId === 'ai-agent') {
      return (
        <AiAgentToolsSection
          app={app}
          canSaveWorkflow={hasPermission(permissions, 'automations:manage')}
          className={sectionClassName}
          draftWorkflowFromRun={draftWorkflowFromAdHocRunAction}
          hideHeader={inline}
          openWorkflowDraft={() => router.push('/automations/create')}
          onRunStarted={run => {
            setLatestAutomationRun(run)
            setActiveTool('ai-agent')
          }}
        />
      )
    }

    if (toolId === 'automations') {
      return (
        <AutomationStatusToolsSection
          app={app}
          latestRun={latestAutomationRun}
          className={cn(sectionClassName, inline && 'px-0')}
          hideHeader={inline}
          onRunStarted={run => {
            setLatestAutomationRun(run)
            setActiveTool('automations')
          }}
        />
      )
    }

    if (toolId === 'network-access') {
      return (
        <NetworkAccessToolsSection
          app={app}
          permissions={permissions}
          onAppChange={setApp}
          className={cn(sectionClassName, inline && 'px-0')}
          hideHeader={inline}
        />
      )
    }

    return (
      <StreamingToolsSection
        viewerSettings={viewerSettings}
        onViewerSettingsChange={setViewerSettings}
        streamMetrics={latestStreamMetrics}
        className={cn(sectionClassName, inline && 'px-0')}
        hideHeader={inline}
      />
    )
  }

  return (
    <div className='flex min-h-0 w-full flex-1 flex-col gap-4 max-sm:px-4'>
      <div className='flex min-h-0 flex-1 flex-col overflow-hidden'>
        <div
          role='tablist'
          aria-label='Runtime tools'
          className='flex w-full min-w-0 items-center gap-1 overflow-x-auto scrollbar-thin py-1 px-1.5 rounded-md bg-surface-band/40 border border-border/70'
        >
          {tools.map(tool => (
            <button
              key={tool.id}
              type='button'
              id={`runtime-tool-tab-${tool.id}`}
              role='tab'
              aria-selected={selectedToolId === tool.id}
              aria-controls={`runtime-tool-panel-${tool.id}`}
              tabIndex={selectedToolId === tool.id ? 0 : -1}
              onClick={() => setActiveTool(tool.id)}
              onKeyDown={event => handleToolTabKeyDown(event, tool.id)}
              className={cn(
                'flex shrink-0 items-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors hover:bg-primary/8 hover:text-primary focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none',
                {
                  'bg-primary/10 text-foreground': selectedToolId === tool.id
                }
              )}
            >
              <tool.Icon className={cn('size-5', { 'text-primary': selectedToolId === tool.id })} />
              {tool.title}
            </button>
          ))}
        </div>
        <div
          id={selectedToolId ? `runtime-tool-panel-${selectedToolId}` : undefined}
          role='tabpanel'
          aria-labelledby={selectedToolId ? `runtime-tool-tab-${selectedToolId}` : undefined}
          className={cn(
            'min-h-0 py-4',
            selectedToolId === 'ai-agent'
              ? 'flex h-[min(70dvh,36rem)] flex-1 flex-col overflow-hidden md:h-auto lg:h-full'
              : 'overflow-auto'
          )}
        >
          {selectedToolId ? renderToolContent(selectedToolId, true) : null}
        </div>
      </div>
    </div>
  )
}
