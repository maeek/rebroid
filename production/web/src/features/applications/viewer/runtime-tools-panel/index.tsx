'use client'

import { useMemo, useState } from 'react'
import { IconCast, IconChevronDown, IconClipboard, IconFolder } from '@tabler/icons-react'
import { cn } from '@/lib/utils'
import { hasPermission } from '@/shared/permissions/permissions'
import { ClipboardToolsSection } from './clipboard-tools-section'
import { DownloadsToolsSection } from './downloads-tools-section'
import { StreamingToolsSection } from './streaming-tools-section'
import type { AppDefinition } from '@/features/applications/domain/app-definition'
import type { ViewerSettings } from '@/features/applications/viewer/viewer-settings'
import type { PermissionMap } from '@/shared/permissions/permissions'

type RuntimeToolId = 'clipboard' | 'files' | 'streaming'

export const RuntimeToolsPanel = ({
  app,
  permissions,
  viewerSettings,
  onViewerSettingsChange
}: {
  app: AppDefinition
  permissions: PermissionMap
  viewerSettings: ViewerSettings
  onViewerSettingsChange: (settings: ViewerSettings) => void
}) => {
  const tools = useMemo(
    () =>
      [
        hasPermission(permissions, 'applications:sync-clipboard')
          ? {
              id: 'clipboard' as const,
              title: 'Clipboard',
              description: 'Pull or push text',
              Icon: IconClipboard
            }
          : null,
        hasPermission(permissions, 'applications:transfer-files')
          ? {
              id: 'files' as const,
              title: 'Files',
              description: 'Upload and fetch files',
              Icon: IconFolder
            }
          : null,
        {
          id: 'streaming' as const,
          title: 'Streaming',
          description: `${viewerSettings.player} • ${viewerSettings.bitrateMbps} Mbps`,
          Icon: IconCast
        }
      ].filter((tool): tool is NonNullable<typeof tool> => Boolean(tool)),
    [permissions, viewerSettings.bitrateMbps, viewerSettings.player]
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
                selected ? 'border-primary/75 ring-1 ring-primary/20' : 'border-border/70'
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
                  <div className='border-t border-border/60 px-4 py-4'>{renderToolContent(tool.id, true)}</div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className='hidden flex-col gap-4 md:flex'>
        {tools.map(tool => (
          <div key={tool.id}>{renderToolContent(tool.id)}</div>
        ))}
      </div>
    </div>
  )
}
