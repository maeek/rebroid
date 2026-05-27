'use client'

import { useMemo, type ReactNode } from 'react'
import { IconCast } from '@tabler/icons-react'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getViewerPlayerCapabilities } from '../viewer-player-capabilities'
import {
  isViewerPlayer,
  normalizeViewerSettings,
  viewerPlayerDefinitions,
  viewerStreamingPresets
} from '../viewer-settings'
import { ViewerStreamingSliderFields } from '../viewer-streaming-slider-fields'
import { ToolSection } from './tool-section'
import type { ViewerSettings, ViewerStreamingPreset } from '../viewer-settings'

const maxSizeOptions = [0, 1080, 1440, 1920]

const StreamingSetting = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className='grid min-w-0 gap-2'>
    <span className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>{label}</span>
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

  const updateSettings = (patch: Partial<ViewerSettings>) => {
    onViewerSettingsChange(normalizeViewerSettings({ ...viewerSettings, ...patch }))
  }

  const applyPreset = (preset: ViewerStreamingPreset) => {
    onViewerSettingsChange(normalizeViewerSettings({ ...viewerSettings, ...viewerStreamingPresets[preset] }))
  }

  const rendererNote = selectedCapability.reason ?? selectedPlayer?.description
  const streamingSummary = `${viewerSettings.transport.toUpperCase()} • ${selectedPlayer?.label ?? viewerSettings.player} • ${viewerSettings.bitrateMbps} Mbps • ${viewerSettings.maxFps} fps • ${viewerSettings.maxSize === 0 ? 'Fit frame' : `${viewerSettings.maxSize}px`}`
  const transportLabel = viewerSettings.transport === 'webrtc' ? 'WebRTC' : 'WebSocket'
  const transportDetail =
    viewerSettings.transport === 'webrtc'
      ? 'WebRTC selected: video and controls use the low-latency peer connection when the viewer reloads.'
      : 'WebSocket selected: video and controls use the legacy websocket stream when the viewer reloads.'

  return (
    <ToolSection
      title='Streaming'
      description='Changes apply when the viewer reloads or starts a new stream.'
      icon={<IconCast className='size-5' />}
      className={className}
      hideHeader={hideHeader}
    >
      <div className='grid gap-4'>
        <div className='flex min-w-0 flex-wrap items-center gap-2 rounded-md border border-border/70 bg-muted/30 px-3 py-2'>
          <Badge
            variant={viewerSettings.transport === 'webrtc' ? 'status' : 'secondary'}
            className='uppercase tracking-wide'
          >
            {transportLabel}
          </Badge>
          <span className='min-w-0 flex-1 text-xs leading-relaxed text-muted-foreground'>{transportDetail}</span>
        </div>

        <div className='grid gap-x-6 gap-y-4 md:grid-cols-2'>
          <StreamingSetting label='Preset'>
            <Select
              value={viewerSettings.preset}
              onValueChange={value => applyPreset(value as ViewerStreamingPreset)}
            >
              <SelectTrigger className='w-full'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='bandwidth'>Bandwidth</SelectItem>
                <SelectItem value='balanced'>Balanced</SelectItem>
                <SelectItem value='quality'>Quality</SelectItem>
              </SelectContent>
            </Select>
          </StreamingSetting>

          <StreamingSetting label='Renderer'>
            <Select
              value={viewerSettings.player}
              onValueChange={value =>
                updateSettings({
                  player: isViewerPlayer(value) ? value : 'webcodecs'
                })
              }
            >
              <SelectTrigger className='w-full'>
                <SelectValue>{selectedPlayer?.label ?? viewerSettings.player}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {viewerPlayerDefinitions.map(option => {
                  const capability = playerCapabilities[option.value]

                  return (
                    <SelectItem
                      key={option.value}
                      value={option.value}
                      disabled={!capability.supported}
                    >
                      {option.label}
                      {!capability.supported ? ' (unavailable)' : ''}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </StreamingSetting>

          <StreamingSetting label='Transport'>
            <Select
              value={viewerSettings.transport}
              onValueChange={value => updateSettings({ transport: value === 'websocket' ? 'websocket' : 'webrtc' })}
            >
              <SelectTrigger className='w-full'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='webrtc'>WebRTC</SelectItem>
                <SelectItem value='websocket'>WebSocket</SelectItem>
              </SelectContent>
            </Select>
          </StreamingSetting>

          <ViewerStreamingSliderFields
            values={viewerSettings}
            onChange={patch => updateSettings({ ...patch, preset: viewerSettings.preset })}
            SettingComponent={StreamingSetting}
          />

          <StreamingSetting label='Max size'>
            <Select
              value={String(viewerSettings.maxSize)}
              onValueChange={value => updateSettings({ maxSize: Number(value), fitToFrame: value === '0' })}
            >
              <SelectTrigger className='w-full'>
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
        </div>

        <div className='flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground'>
          <span>{streamingSummary}</span>
          <span className='hidden text-border sm:inline'>/</span>
          <span>{rendererNote}</span>
        </div>
      </div>
    </ToolSection>
  )
}
