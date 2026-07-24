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
import { ToolSection } from '../tool-section'
import type { DisplayViewerStreamMetrics } from '@/features/applications/viewer/display/display-viewer-stream-status'
import type { ViewerSettings, ViewerStreamingPreset } from '@/features/applications/viewer/settings/viewer-settings'

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
    <div className='grid gap-2 sm:grid-cols-2 xl:grid-cols-4'>
      <div className='flex items-center gap-2 rounded-control border border-surface-border/70 bg-surface-band/35 px-3 py-2 text-xs'>
        <IconActivityHeartbeat className='size-4 text-primary' />
        <span className='text-foreground-muted'>Source FPS</span>
        <span className='ml-auto font-medium text-foreground'>{fresh ? metricValue(metrics?.sourceFps) : '--'}</span>
      </div>
      <div className='flex items-center gap-2 rounded-control border border-surface-border/70 bg-surface-band/35 px-3 py-2 text-xs'>
        <IconActivityHeartbeat className='size-4 text-primary' />
        <span className='text-foreground-muted'>Presented FPS</span>
        <span className='ml-auto font-medium text-foreground'>{fresh ? metricValue(metrics?.presentedFps) : '--'}</span>
      </div>
      <div className='flex items-center gap-2 rounded-control border border-surface-border/70 bg-surface-band/35 px-3 py-2 text-xs'>
        <IconGauge className='size-4 text-primary' />
        <span className='text-foreground-muted'>Bitrate</span>
        <span className='ml-auto font-medium text-foreground'>
          {fresh ? `${metricValue(metrics?.wireBitrateMbps, 1)} Mbps` : '--'}
        </span>
      </div>
      <div className='flex items-center gap-2 rounded-control border border-surface-border/70 bg-surface-band/35 px-3 py-2 text-xs'>
        <IconNetwork className='size-4 text-primary' />
        <span className='text-foreground-muted'>{metrics?.transport === 'webrtc' ? 'RTT' : 'Queue'}</span>
        <span className='ml-auto font-medium text-foreground'>
          {fresh && metrics?.transport === 'webrtc' && typeof metrics.roundTripTimeMs === 'number'
            ? `${metricValue(metrics.roundTripTimeMs)} ms`
            : fresh && typeof metrics?.relayQueueDepthMs === 'number'
              ? `${metricValue(metrics.relayQueueDepthMs)} ms`
              : '--'}
        </span>
      </div>
    </div>
  )
}

const DiagnosticValue = ({ label, value }: { label: string; value: string }) => (
  <div className='flex min-w-0 items-center justify-between gap-3 border-b border-surface-border/50 py-1.5 last:border-b-0'>
    <span className='text-foreground-muted'>{label}</span>
    <span className='truncate font-mono text-foreground'>{value}</span>
  </div>
)

const StreamingDiagnostics = ({ metrics }: { metrics?: DisplayViewerStreamMetrics | null }) => {
  if (!metricIsFresh(metrics) || !metrics) {
    return null
  }

  const profile = metrics.effectiveProfile
  return (
    <details className='rounded-control border border-surface-border/70 bg-surface-band/20 px-3 py-2 text-xs'>
      <summary className='cursor-pointer font-medium text-foreground'>Streaming diagnostics</summary>
      <div className='mt-2 grid gap-x-6 lg:grid-cols-2'>
        <DiagnosticValue
          label='Pipeline FPS'
          value={[
            metrics.sourceFps,
            metrics.bridgeInputFps ?? metrics.relayIngressFps,
            metrics.rtpSentFps,
            metrics.receivedFps,
            metrics.decodedFps,
            metrics.presentedFps
          ]
            .map(value => metricValue(value))
            .join(' → ')}
        />
        <DiagnosticValue
          label='Renderer'
          value={`${metrics.renderer}${metrics.decoderPreference ? ` / ${metrics.decoderPreference}` : ''}`}
        />
        <DiagnosticValue
          label='Encoder'
          value={profile.actualEncoder ?? 'unknown'}
        />
        <DiagnosticValue
          label='H.264 profile'
          value={metrics.negotiatedH264ProfileLevelId ?? metrics.h264ProfileLevelId ?? 'unknown'}
        />
        <DiagnosticValue
          label='Dimensions'
          value={metrics.width && metrics.height ? `${metrics.width}×${metrics.height}` : 'unknown'}
        />
        <DiagnosticValue
          label='Frame gap p95 / max'
          value={`${metricValue(metrics.frameGapP95Ms, 1)} / ${metricValue(metrics.frameGapMaxMs, 1)} ms`}
        />
        <DiagnosticValue
          label='Network jitter p95'
          value={`${metricValue(metrics.networkInterArrivalJitterP95Ms, 1)} ms`}
        />
        <DiagnosticValue
          label='Decode / presentation queue'
          value={`${metricValue(metrics.decoderQueueDepth)} / ${metricValue(metrics.presentationSequenceLag)} frames`}
        />
        <DiagnosticValue
          label='Live-edge buffer'
          value={`${metricValue(
            metrics.mseBufferedLeadMs ?? metrics.webrtcJitterBufferDepthMs,
            1
          )} ms (target ${metricValue(metrics.jitterBufferTargetMs)} ms)`}
        />
        <DiagnosticValue
          label='Relay / RTP write p95'
          value={`${metricValue(metrics.relayP95Ms, 2)} / ${metricValue(metrics.rtpWriteP95Ms, 2)} ms`}
        />
        <DiagnosticValue
          label='Drops'
          value={`${metricValue(metrics.relayDroppedFrames)} relay, ${metricValue(
            metrics.decodeDroppedFrames
          )} decode, ${metricValue(metrics.presentationDroppedFrames)} present`}
        />
        <DiagnosticValue
          label='Recovery'
          value={[
            `${metricValue(metrics.reconnectCount)} reconnect`,
            `${metricValue(metrics.resyncCount)} resync`,
            `${metricValue(metrics.videoResetCount)} reset`
          ].join(', ')}
        />
      </div>
    </details>
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
  const selectedPreset = viewerStreamingPresets[viewerSettings.preset]
  const presetIsCustom =
    selectedPreset.player !== viewerSettings.player ||
    selectedPreset.transport !== viewerSettings.transport ||
    selectedPreset.bitrateMbps !== viewerSettings.bitrateMbps ||
    selectedPreset.maxFps !== viewerSettings.maxFps ||
    selectedPreset.maxSize !== viewerSettings.maxSize

  const updateSettings = (patch: Partial<ViewerSettings>) => {
    onViewerSettingsChange(normalizeViewerSettings({ ...viewerSettings, ...patch }))
  }

  const applyPreset = (preset: ViewerStreamingPreset) => {
    onViewerSettingsChange(normalizeViewerSettings({ ...viewerSettings, ...viewerStreamingPresets[preset] }))
  }

  const rendererNote = selectedCapability.reason ?? selectedPlayer?.description
  const streamingSummary = `${selectedPlayer?.label ?? viewerSettings.player} • ${viewerSettings.bitrateMbps} Mbps • ${viewerSettings.maxFps} fps • ${viewerSettings.maxSize === 0 ? 'Native resolution' : `${viewerSettings.maxSize}px long edge`}`

  return (
    <ToolSection
      title={
        <div className='flex items-center gap-x-2'>
          Streaming
          <Badge
            variant={viewerSettings.transport === 'webrtc' ? 'success' : 'neutral'}
            className='uppercase tracking-wide px-1.5 py-0.5 text-xs font-medium'
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
            value={presetIsCustom ? 'custom' : viewerSettings.preset}
            onValueChange={value => {
              if (value !== 'custom') applyPreset(value)
            }}
          >
            <SelectTrigger className='w-full lg:max-w-100'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                value='custom'
                disabled
              >
                Custom
              </SelectItem>
              <SelectItem value='low-latency'>Low latency</SelectItem>
              <SelectItem value='balanced'>Balanced</SelectItem>
              <SelectItem value='high-quality'>High quality</SelectItem>
              <SelectItem value='bandwidth-saver'>Bandwidth saver</SelectItem>
            </SelectContent>
          </Select>
        </StreamingSetting>

        <StreamingMetricBadges metrics={streamMetrics} />
        <StreamingDiagnostics metrics={streamMetrics} />

        <p className='text-xs text-foreground-muted'>
          Encoder target {viewerSettings.bitrateMbps} Mbps is an upper quality target. Wire bitrate reflects current
          encoded traffic and is naturally lower on static screens. Interactive streaming always requests native
          resolution at 60 fps.
        </p>

        <div className='flex flex-col gap-2'>
          <div className='grid overflow-hidden transition-[grid-template-rows,opacity,padding-top,padding-bottom] duration-200 ease-out grid-rows-[1fr] opacity-100'>
            <div className='min-h-0 flex flex-col gap-4'>
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
