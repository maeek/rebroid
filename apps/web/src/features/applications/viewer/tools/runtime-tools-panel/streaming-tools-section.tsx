'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getViewerPlayerCapabilities } from '@/features/applications/viewer/player/viewer-player-capabilities'
import {
  normalizeViewerSettings,
  viewerPlayerDefinitions,
  viewerStreamingPresets
} from '@/features/applications/viewer/settings/viewer-settings'
import { ViewerStreamingSliderFields } from '@/features/applications/viewer/settings/viewer-streaming-slider-fields'
import { cn } from '@/lib/utils'
import { ToolSection } from './tool-section'
import type { ViewerSettings, ViewerStreamingPreset } from '@/features/applications/viewer/settings/viewer-settings'

const maxSizeOptions = [0, 1080, 1440, 1920]

const StreamingSetting = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className='flex flex-col gap-1.5 min-w-0 lg:flex-row lg:py-1 lg:items-center'>
    <span className='text-xs font-medium uppercase tracking-wide lg:flex-1/4'>{label}</span>
    {children}
  </label>
)

export const StreamingToolsSection = ({
  viewerSettings,
  onViewerSettingsChange,
  className,
  hideHeader
}: {
  viewerSettings: ViewerSettings
  onViewerSettingsChange: (settings: ViewerSettings) => void
  className?: string
  hideHeader?: boolean
}) => {
  const playerCapabilities = useMemo(() => getViewerPlayerCapabilities(), [])
  const selectedPlayer = viewerPlayerDefinitions.find(player => player.value === viewerSettings.player)
  const selectedCapability = playerCapabilities[viewerSettings.player]
  const [showAdvanced, setShowAdvanced] = useState(false)

  const updateSettings = (patch: Partial<ViewerSettings>) => {
    onViewerSettingsChange(normalizeViewerSettings({ ...viewerSettings, ...patch }))
  }

  const applyPreset = (preset: ViewerStreamingPreset) => {
    onViewerSettingsChange(normalizeViewerSettings({ ...viewerSettings, ...viewerStreamingPresets[preset] }))
  }

  const rendererNote = selectedCapability.reason ?? selectedPlayer?.description
  const streamingSummary = `${selectedPlayer?.label ?? viewerSettings.player} • ${viewerSettings.bitrateMbps} Mbps • ${viewerSettings.maxFps} fps • ${viewerSettings.maxSize === 0 ? 'Fit frame' : `${viewerSettings.maxSize}px`}`

  return (
    <ToolSection
      title={
        <div className='flex items-center gap-x-2'>
          Streaming
          <Badge
            variant={viewerSettings.transport === 'webrtc' ? 'status' : 'secondary'}
            className='uppercase tracking-wide px-1.5 py-0.5 text-[10px] font-medium'
          >
            {viewerSettings.transport === 'webrtc' ? 'WebRTC' : 'WebSocket'}
          </Badge>
        </div>
      }
      description={
        <div className='flex flex-wrap items-center gap-x-1 text-xs text-secondary-foreground'>
          <span>{streamingSummary}</span>
          <span>•</span>
          <span>{rendererNote}</span>
        </div>
      }
      className={className}
      hideHeader={hideHeader}
    >
      <div className='flex flex-col gap-4'>
        <StreamingSetting label='Transport'>
          <Select
            value={viewerSettings.transport}
            onValueChange={value => updateSettings({ transport: value === 'websocket' ? 'websocket' : 'webrtc' })}
          >
            <SelectTrigger className='w-full lg:max-w-100'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='webrtc'>WebRTC</SelectItem>
              <SelectItem value='websocket'>WebSocket</SelectItem>
            </SelectContent>
          </Select>
        </StreamingSetting>

        <StreamingSetting label='Preset'>
          <Select
            value={viewerSettings.preset}
            onValueChange={value => applyPreset(value as ViewerStreamingPreset)}
          >
            <SelectTrigger className='w-full lg:max-w-100'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='bandwidth'>Bandwidth</SelectItem>
              <SelectItem value='balanced'>Balanced</SelectItem>
              <SelectItem value='quality'>Quality</SelectItem>
            </SelectContent>
          </Select>
        </StreamingSetting>

        <div className='flex flex-col gap-2'>
          <div
            className={cn(
              'grid overflow-hidden transition-[grid-template-rows,opacity,padding-top,padding-bottom] duration-200 ease-out',
              {
                'grid-rows-[1fr] opacity-100': showAdvanced,
                'grid-rows-[0fr] opacity-0 pt-0 pb-0': !showAdvanced
              }
            )}
          >
            <div className='min-h-0 flex flex-col gap-4'>
              <StreamingSetting label='Max size'>
                <Select
                  value={String(viewerSettings.maxSize)}
                  onValueChange={value => updateSettings({ maxSize: Number(value), fitToFrame: value === '0' })}
                >
                  <SelectTrigger className='w-full lg:max-w-100'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {maxSizeOptions.map(value => (
                      <SelectItem
                        key={value}
                        value={String(value)}
                      >
                        {value === 0 ? 'Fit frame' : `${value}px`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </StreamingSetting>

              <ViewerStreamingSliderFields
                values={viewerSettings}
                onChange={patch => updateSettings({ ...patch, preset: viewerSettings.preset })}
                SettingComponent={StreamingSetting}
              />
            </div>
          </div>
          <Button
            className='my-2'
            variant='ghost'
            onClick={() => setShowAdvanced(current => !current)}
          >
            {showAdvanced ? 'Hide advanced settings' : 'Show advanced settings'}
          </Button>
        </div>
      </div>
    </ToolSection>
  )
}
