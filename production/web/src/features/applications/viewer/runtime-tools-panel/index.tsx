'use client'

import { useMemo, useState } from 'react'
import { IconClipboard, IconDownload, IconSettings2 } from '@tabler/icons-react'
import { ClipboardToolsSection } from './clipboard-tools-section'
import { DownloadsToolsSection } from './downloads-tools-section'
import { StreamingToolsSection } from './streaming-tools-section'
import { cn } from '@/lib/utils'
import { hasPermission } from '@/shared/permissions/permissions'
import type { AppDefinition } from '@/features/applications/domain/app-definition'
import type { ViewerSettings } from '@/features/applications/viewer/viewer-settings'
import type { PermissionMap } from '@/shared/permissions/permissions'

type RuntimeToolId = 'clipboard' | 'downloads' | 'streaming'

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
              id: 'downloads' as const,
              title: 'Downloads',
              description: 'Upload and fetch files',
              Icon: IconDownload
            }
          : null,
        {
          id: 'streaming' as const,
          title: 'Streaming',
          description: `${viewerSettings.player} • ${viewerSettings.bitrateMbps} Mbps`,
          Icon: IconSettings2
        }
      ].filter((tool): tool is NonNullable<typeof tool> => Boolean(tool)),
    [permissions, viewerSettings.bitrateMbps, viewerSettings.player]
  )
  const [activeTool, setActiveTool] = useState<RuntimeToolId>(() => tools[0]?.id ?? 'streaming')
  const resolvedActiveTool = tools.some(tool => tool.id === activeTool) ? activeTool : (tools[0]?.id ?? 'streaming')

  return (
    <div className='flex w-full flex-col gap-4'>
      <div className='grid grid-cols-3 gap-3 max-md:grid-cols-1'>
        {tools.map(tool => {
          const selected = resolvedActiveTool === tool.id

          return (
            <button
              key={tool.id}
              type='button'
              className={cn(
                'flex items-center gap-3 rounded-lg border p-4 text-left transition-colors',
                'bg-card/25 hover:border-primary/55 hover:bg-card/45',
                selected ? 'border-primary/75 ring-1 ring-primary/25' : 'border-border/70'
              )}
              onClick={() => setActiveTool(tool.id)}
            >
              <span
                className={cn(
                  'flex size-10 shrink-0 items-center justify-center rounded-lg border',
                  selected
                    ? 'border-primary/40 bg-primary/20 text-primary'
                    : 'border-border/70 bg-background/40 text-secondary-foreground'
                )}
              >
                <tool.Icon className='size-5' />
              </span>
              <span className='min-w-0'>
                <span className='block font-medium'>{tool.title}</span>
                <span className='mt-1 block truncate text-xs text-secondary-foreground'>{tool.description}</span>
              </span>
            </button>
          )
        })}
      </div>

      {resolvedActiveTool === 'clipboard' ? (
        <ClipboardToolsSection
          app={app}
          permissions={permissions}
        />
      ) : null}
      {resolvedActiveTool === 'downloads' ? (
        <DownloadsToolsSection
          app={app}
          permissions={permissions}
        />
      ) : null}
      {resolvedActiveTool === 'streaming' ? (
        <StreamingToolsSection
          viewerSettings={viewerSettings}
          onViewerSettingsChange={onViewerSettingsChange}
        />
      ) : null}
    </div>
  )
}
