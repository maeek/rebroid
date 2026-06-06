'use client'

import { useMemo, useState, type KeyboardEvent } from 'react'
import {
  IconCast,
  IconChevronDown,
  IconClipboard,
  IconFolder,
  IconLogs,
  IconRobot,
  IconSparkles,
  IconWorld
} from '@tabler/icons-react'
import { useApplicationViewerApp } from '@/features/applications/detail/application-viewer-context'
import { AppLogsContent } from '@/features/applications/viewer/logs/app-logs-content'
import { cn } from '@/lib/utils'
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
  const { app, permissions, setApp, setViewerSettings, viewerSettings } = useApplicationViewerApp()
  const [latestAutomationRun, setLatestAutomationRun] = useState<AutomationRun | null>(null)
  const tools = useMemo(
    () =>
      [
        hasPermission(permissions, 'automations:run') && hasPermission(permissions, 'automations:run-ai') && app.running
          ? {
              id: 'ai-agent' as const,
              title: 'AI agent',
              description: 'Run ad-hoc automation',
              Icon: IconSparkles
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
          className={sectionClassName}
          hideHeader={inline}
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
        className={cn(sectionClassName, inline && 'px-0')}
        hideHeader={inline}
      />
    )
  }

  return (
    <div className='flex w-full flex-col gap-4 max-sm:px-4'>
      <div className='grid gap-3 md:hidden'>
        {tools.map(tool => {
          const selected = activeTool === tool.id

          return (
            <div
              key={tool.id}
              className={cn(
                'overflow-hidden rounded-2xl border bg-card/25 transition-colors',
                selected ? 'ring-1 ring-primary/20' : 'border-border/70'
              )}
            >
              <button
                type='button'
                className={cn(
                  'flex w-full items-center gap-3 px-4 py-4 text-left transition-colors',
                  selected ? 'bg-card/55' : 'hover:bg-card/40'
                )}
                onClick={() => setActiveTool(current => (current === tool.id ? null : tool.id))}
              >
                <span
                  className={cn(
                    'flex size-10 shrink-0 items-center justify-center rounded-lg border transition-colors',
                    selected
                      ? 'border-primary/40 bg-primary/20 text-primary'
                      : 'border-border/70 bg-background/40 text-secondary-foreground'
                  )}
                >
                  <tool.Icon className='size-5' />
                </span>
                <span className='min-w-0 grow'>
                  <span className='block font-medium'>{tool.title}</span>
                  <span className='mt-1 block truncate text-xs text-secondary-foreground'>{tool.description}</span>
                </span>
                <IconChevronDown
                  className={cn('size-4 shrink-0 text-secondary-foreground transition-transform duration-300', {
                    'rotate-180 text-primary': selected
                  })}
                />
              </button>
              <div
                className={cn('grid transition-all duration-300 ease-out', {
                  'grid-rows-[1fr] opacity-100': selected,
                  'grid-rows-[0fr] opacity-0': !selected
                })}
              >
                <div className='min-h-0 overflow-hidden'>
                  <div className='border-t border-border/60 p-4'>{renderToolContent(tool.id, true)}</div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className='hidden min-w-0 flex-col overflow-hidden md:flex'>
        <div
          role='tablist'
          aria-label='Runtime tools'
          className='flex w-full min-w-0 items-center gap-2 overflow-x-auto border-b border-border/70 py-2 [scrollbar-width:thin]'
        >
          {tools.map(tool => (
            <button
              key={tool.id}
              type='button'
              id={`runtime-tool-tab-${tool.id}`}
              role='tab'
              aria-selected={activeTool === tool.id}
              aria-controls={`runtime-tool-panel-${tool.id}`}
              tabIndex={activeTool === tool.id ? 0 : -1}
              onClick={() => setActiveTool(tool.id)}
              onKeyDown={event => handleToolTabKeyDown(event, tool.id)}
              className={cn(
                'flex shrink-0 items-center gap-2 rounded-md px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors hover:bg-card/45 hover:text-primary focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none',
                {
                  'bg-primary/10 text-foreground': activeTool === tool.id
                }
              )}
            >
              <tool.Icon className={cn('size-5', { 'text-primary': activeTool === tool.id })} />
              {tool.title}
            </button>
          ))}
        </div>
        <div
          id={activeTool ? `runtime-tool-panel-${activeTool}` : undefined}
          role='tabpanel'
          aria-labelledby={activeTool ? `runtime-tool-tab-${activeTool}` : undefined}
          className='py-4'
        >
          {tools.find(tool => tool.id === activeTool)?.id &&
            renderToolContent(tools.find(tool => tool.id === activeTool)!.id, true)}
        </div>
      </div>
    </div>
  )
}
