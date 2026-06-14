'use client'

import { useMemo, type ReactNode } from 'react'
import { IconActivityHeartbeat, IconGauge, IconNetwork } from '@tabler/icons-react'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { getViewerPlayerCapabilities } from '@/features/applications/viewer/player/viewer-player-capabilities'
import {
  normalizeViewerSettings,
  viewerPlayerDefinitions,
  viewerStreamingPresets
} from '@/features/applications/viewer/settings/viewer-settings'
import { ViewerStreamingSliderFields } from '@/shared/ui/settings/viewer-streaming-slider-fields'
import { ToolSection } from './tool-section'
import type { DisplayViewerStreamMetrics } from '@/features/applications/viewer/display/display-viewer-stream-status'
import type { ViewerSettings, ViewerStreamingPreset } from '@/features/applications/viewer/settings/viewer-settings'

const maxSizeOptions = [0, 1080, 1440, 1920]

const StreamingSetting = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className='flex flex-col gap-1.5 min-w-0 lg:flex-row lg:py-1 lg:items-center'>
    <span className='text-xs font-medium uppercase tracking-wide lg:flex-1/4'>{label}</span>
    {children}
  </label>
)

const metricIsFresh = (metrics: DisplayViewerStreamMetrics | null | undefined) =>
  Boolean(metrics && Date.now() - metrics.collectedAt < 5_000)

const metricValue = (value: number | undefined, digits = 0) =>
  typeof value === 'number' && Number.isFinite(value) ? value.toFixed(digits) : '--'

const StreamingMetricBadges = ({ metrics }: { metrics?: DisplayViewerStreamMetrics | null }) => {
  const fresh = metricIsFresh(metrics)

  return (
    <div className='grid gap-2 sm:grid-cols-3'>
      <div className='flex items-center gap-2 rounded-md border border-border/70 bg-surface-band/35 px-3 py-2 text-xs'>
        <IconActivityHeartbeat className='size-4 text-primary' />
        <span className='text-foreground-muted'>FPS</span>
        <span className='ml-auto font-medium text-foreground'>{fresh ? metricValue(metrics?.fps) : '--'}</span>
      </div>
      <div className='flex items-center gap-2 rounded-md border border-border/70 bg-surface-band/35 px-3 py-2 text-xs'>
        <IconGauge className='size-4 text-primary' />
        <span className='text-foreground-muted'>Bitrate</span>
        <span className='ml-auto font-medium text-foreground'>
          {fresh ? `${metricValue(metrics?.bitrateMbps, 1)} Mbps` : '--'}
        </span>
      </div>
      <div className='flex items-center gap-2 rounded-md border border-border/70 bg-surface-band/35 px-3 py-2 text-xs'>
        <IconNetwork className='size-4 text-primary' />
        <span className='text-foreground-muted'>Latency</span>
        <span className='ml-auto font-medium text-foreground'>
          {fresh && typeof metrics?.latencyMs === 'number' ? `${metricValue(metrics.latencyMs)} ms` : '--'}
        </span>
      </div>
    </div>
  )
}

export const StreamingToolsSection = ({
  viewerSettings,
  onViewerSettingsChange,
  streamMetrics,
  className,
  hideHeader
}: {
  viewerSettings: ViewerSettings
  onViewerSettingsChange: (settings: ViewerSettings) => void
  streamMetrics?: DisplayViewerStreamMetrics | null
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
        <div className='flex flex-wrap items-center gap-x-1 text-xs text-foreground-muted'>
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

        <StreamingSetting label='Sound capture'>
          <div className='flex min-w-0 items-center gap-3'>
            <Switch
              checked={viewerSettings.soundEnabled}
              onCheckedChange={enabled => updateSettings({ soundEnabled: Boolean(enabled) })}
              aria-label='Enable Android sound capture'
            />
            <span className='text-xs text-foreground-muted'>
              {viewerSettings.soundEnabled ? 'Request Android audio for this stream.' : 'Video-only stream.'}
            </span>
          </div>
        </StreamingSetting>

        <StreamingSetting label='Preset'>
          <Select
            value={viewerSettings.preset}
            onValueChange={value => applyPreset(value)}
          >
            <SelectTrigger className='w-full lg:max-w-100'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='low-latency'>Low latency</SelectItem>
              <SelectItem value='balanced'>Balanced</SelectItem>
              <SelectItem value='high-quality'>High quality</SelectItem>
              <SelectItem value='bandwidth-saver'>Bandwidth saver</SelectItem>
            </SelectContent>
          </Select>
        </StreamingSetting>

        <StreamingMetricBadges metrics={streamMetrics} />

        <div className='flex flex-col gap-2'>
          <div className='grid overflow-hidden transition-[grid-template-rows,opacity,padding-top,padding-bottom] duration-200 ease-out grid-rows-[1fr] opacity-100'>
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
        </div>
      </div>
    </ToolSection>
  )
}
