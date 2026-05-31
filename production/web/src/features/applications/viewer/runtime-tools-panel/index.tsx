'use client'

import { useMemo, useState } from 'react'
import { IconCast, IconChevronDown, IconClipboard, IconFolder, IconLogs, IconWorld } from '@tabler/icons-react'
import { cn } from '@/lib/utils'
import { hasPermission } from '@/shared/permissions/permissions'
import { AppLogsContent } from '../app-logs-content'
import { ClipboardToolsSection } from './clipboard-tools-section'
import { DownloadsToolsSection } from './downloads-tools-section'
import { NetworkAccessToolsSection } from './network-access-tools-section'
import { StreamingToolsSection } from './streaming-tools-section'
import type { AppDefinition } from '@/features/applications/domain/app-definition'
import type { ViewerSettings } from '@/features/applications/viewer/viewer-settings'
import type { PermissionMap } from '@/shared/permissions/permissions'

type RuntimeToolId = 'clipboard' | 'files' | 'streaming' | 'network-access' | 'logs'

export const RuntimeToolsPanel = ({
  app,
  permissions,
  viewerSettings,
  onAppChange,
  onViewerSettingsChange
}: {
  app: AppDefinition
  permissions: PermissionMap
  viewerSettings: ViewerSettings
  onAppChange: (app: AppDefinition) => void
  onViewerSettingsChange: (settings: ViewerSettings) => void
}) => {
  const tools = useMemo(
    () =>
      [
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
    [app.networkPolicyEnabled, app.running, permissions, viewerSettings.bitrateMbps, viewerSettings.transport]
  )
  const [activeTool, setActiveTool] = useState<RuntimeToolId | null>(() => tools[0]?.id ?? 'streaming')

  const renderToolContent = (toolId: RuntimeToolId, inline = false) => {
    const sectionClassName = inline
      ? 'rounded-none border-0 bg-transparent p-0 shadow-none backdrop-blur-none'
      : undefined

    if (toolId === 'clipboard') {
      return (
        <ClipboardToolsSection
          app={app}
          permissions={permissions}
          className={sectionClassName}
          hideHeader={inline}
        />
      )
    }

    if (toolId === 'files') {
      return (
        <DownloadsToolsSection
          app={app}
          permissions={permissions}
          className={sectionClassName}
          hideHeader={inline}
        />
      )
    }

    if (toolId === 'logs') {
      return (
        <div className='min-h-30 px-4 max-h-300 overflow-auto'>
          <AppLogsContent app={app} />
        </div>
      )
    }

    if (toolId === 'network-access') {
      return (
        <NetworkAccessToolsSection
          app={app}
          permissions={permissions}
          onAppChange={onAppChange}
          className={sectionClassName}
          hideHeader={inline}
        />
      )
    }

    return (
      <StreamingToolsSection
        viewerSettings={viewerSettings}
        onViewerSettingsChange={onViewerSettingsChange}
        className={sectionClassName}
        hideHeader={inline}
      />
    )
  }

  return (
    <div className='flex w-full flex-col gap-4'>
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
                  <div className='border-t border-border/60 py-4'>{renderToolContent(tool.id, true)}</div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className='hidden flex-col gap-4 md:flex rounded-lg border border-border/70 bg-card/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)] backdrop-blur-md'>
        <div className='w-full flex items-center gap-2 border-b-2 border-border/70 pt-1 pb-2 px-2'>
          {tools.map(tool => (
            <button
              key={tool.id}
              type='button'
              onClick={() => setActiveTool(tool.id)}
              className={cn(
                'py-3 px-5 flex gap-2 items-center translate-y-0.5 text-sm rounded-md hover:text-primary transition-all duration-100 cursor-pointer',
                {
                  'bg-primary/10': activeTool === tool.id
                }
              )}
            >
              <tool.Icon className={cn('size-5', { 'text-primary': activeTool === tool.id })} />
              {tool.title}
            </button>
          ))}
        </div>
        <div className='pb-4'>
          {tools.find(tool => tool.id === activeTool)?.id &&
            renderToolContent(tools.find(tool => tool.id === activeTool)!.id)}
        </div>
      </div>
    </div>
  )
}
