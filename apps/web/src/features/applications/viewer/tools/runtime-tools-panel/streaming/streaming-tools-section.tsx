'use client'

import { useMemo } from 'react'
import { IconActivityHeartbeat, IconGauge, IconNetwork } from '@tabler/icons-react'
import { Badge } from '@/components/ui/badge'
import { FormField } from '@/components/ui/form-field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { frameAcknowledgementLabels } from '@/features/applications/viewer/display/display-viewer-stream-status'
import { getViewerPlayerCapabilities } from '@/features/applications/viewer/player/viewer-player-capabilities'
import {
  viewerPlayerDefinitions,
  viewerStreamingPresets
} from '@/features/applications/viewer/settings/viewer-settings'
import { useFeatureFlags } from '@/shared/model/features/feature-flags-context'
import { ViewerBitrateField } from '@/shared/ui/settings/viewer-bitrate-field'
import { ToolSection } from '../tool-section'
import type { DisplayViewerStreamMetrics } from '@/features/applications/viewer/display/display-viewer-stream-status'
import type { ViewerSettings } from '@/features/applications/viewer/settings/viewer-settings'

const metricIsFresh = (metrics: DisplayViewerStreamMetrics | null | undefined) =>
  Boolean(metrics && Date.now() - metrics.collectedAt < 5_000)

const metricValue = (value: number | undefined, digits = 0) =>
  typeof value === 'number' && Number.isFinite(value) ? value.toFixed(digits) : '--'

const StreamingMetricBadges = ({ metrics }: { metrics?: DisplayViewerStreamMetrics | null }) => {
  if (!metrics || !metricIsFresh(metrics)) return null

  const isWebRtc = metrics.transport === 'webrtc'
  const networkDelay = isWebRtc ? metrics.roundTripTimeMs : metrics.relayQueueDepthMs

  return (
    <div className='grid grid-cols-2 gap-2'>
      <div className='flex items-center gap-2 rounded-control border border-surface-border/70 bg-surface-band/35 px-3 py-2 text-xs'>
        <IconActivityHeartbeat className='size-4 text-primary' />
        <span className='text-foreground-muted'>Source FPS</span>
        <span className='ml-auto font-medium text-foreground'>{metricValue(metrics.sourceFps)}</span>
      </div>
      <div className='flex items-center gap-2 rounded-control border border-surface-border/70 bg-surface-band/35 px-3 py-2 text-xs'>
        <IconActivityHeartbeat className='size-4 text-primary' />
        <span className='text-foreground-muted'>Presented FPS</span>
        <span className='ml-auto font-medium text-foreground'>{metricValue(metrics.presentedFps)}</span>
      </div>
      <div className='flex items-center gap-2 rounded-control border border-surface-border/70 bg-surface-band/35 px-3 py-2 text-xs'>
        <IconGauge className='size-4 text-primary' />
        <span className='text-foreground-muted'>Bitrate</span>
        <span className='ml-auto font-medium text-foreground'>
          {typeof metrics.wireBitrateMbps === 'number' ? `${metricValue(metrics.wireBitrateMbps, 1)} Mbps` : '--'}
        </span>
      </div>
      <div className='flex items-center gap-2 rounded-control border border-surface-border/70 bg-surface-band/35 px-3 py-2 text-xs'>
        <IconNetwork className='size-4 text-primary' />
        <span className='text-foreground-muted'>{isWebRtc ? 'RTT' : 'Queue'}</span>
        <span className='ml-auto font-medium text-foreground'>
          {typeof networkDelay === 'number' ? `${metricValue(networkDelay)} ms` : '--'}
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
  const sizeChange = metrics.displaySizePresentation
  let sizeChangeDetails: string | undefined
  if (sizeChange) {
    const previous = `${sizeChange.previous.width}×${sizeChange.previous.height}`
    const current = `${sizeChange.current.width}×${sizeChange.current.height}`
    const duration = sizeChange.elapsedMs === undefined ? '' : ` · ${metricValue(sizeChange.elapsedMs)} ms`
    sizeChangeDetails = `${previous} → ${current}${duration}`
  }
  return (
    <details className='rounded-control border border-surface-border/70 bg-surface-band/20 px-3 py-2 text-xs'>
      <summary className='cursor-pointer font-medium text-foreground'>Streaming diagnostics</summary>
      <div className='mt-2 grid gap-x-6'>
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
        {sizeChangeDetails && (
          <DiagnosticValue
            label='First frame at new size'
            value={sizeChangeDetails}
          />
        )}
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
        {metrics.transport === 'webrtc' && (
          <>
            <DiagnosticValue
              label='Received / decoded / presented frames'
              value={[metrics.receivedFrames, metrics.decodedFrames, metrics.presentedFrames]
                .map(value => metricValue(value))
                .join(' / ')}
            />
            <DiagnosticValue
              label='Receiver loss / NACK / PLI'
              value={[metrics.receiverPacketsLost, metrics.receiverNackCount, metrics.receiverPliCount]
                .map(value => metricValue(value))
                .join(' / ')}
            />
            {metrics.frameAcknowledgement && (
              <DiagnosticValue
                label='Frame acknowledgement'
                value={[
                  frameAcknowledgementLabels[metrics.frameAcknowledgement],
                  metrics.frameAcknowledgementsSent === undefined
                    ? undefined
                    : `${metricValue(metrics.frameAcknowledgementsSent)} sent this attempt`
                ]
                  .filter(Boolean)
                  .join(' · ')}
              />
            )}
            <DiagnosticValue
              label='Consumer attempt'
              value={metrics.consumerAttemptId ?? 'unknown'}
            />
            <DiagnosticValue
              label='Source attempt'
              value={metrics.sourceAttemptId ?? 'unknown'}
            />
            <DiagnosticValue
              label='Codec / reset generation'
              value={`${metricValue(metrics.sourceCodecGeneration)} / ${metricValue(metrics.videoResetGeneration)}`}
            />
            <DiagnosticValue
              label='Encoder reset completion'
              value={
                metrics.videoResetCompletedGeneration === undefined
                  ? 'pending or not requested'
                  : [
                      `generation ${metricValue(metrics.videoResetCompletedGeneration)}`,
                      `in ${metricValue(metrics.videoResetElapsedMs)} ms`
                    ].join(' ')
              }
            />
          </>
        )}
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
  bitrateInput,
  onBitrateInputChange,
  streamMetrics,
  className,
  hideHeader
}: {
  viewerSettings: ViewerSettings
  onViewerSettingsChange: (patch: Partial<ViewerSettings>) => void
  bitrateInput: string
  onBitrateInputChange: (value: string) => void
  streamMetrics?: DisplayViewerStreamMetrics | null
  className?: string
  hideHeader?: boolean
}) => {
  const { isFeatureEnabled } = useFeatureFlags()
  const webrtcEnabled = isFeatureEnabled('feature.display-webrtc')
  const transport = webrtcEnabled ? viewerSettings.transport : 'websocket'
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

  const rendererNote = selectedCapability.reason ?? selectedPlayer?.description
  const streamingSummary = `${selectedPlayer?.label ?? viewerSettings.player} • ${viewerSettings.bitrateMbps} Mbps • ${viewerSettings.maxFps} fps • ${viewerSettings.maxSize === 0 ? 'Native resolution' : `${viewerSettings.maxSize}px long edge`}`

  return (
    <ToolSection
      title={
        <div className='flex items-center gap-x-2'>
          Streaming
          <Badge
            variant={transport === 'webrtc' ? 'success' : 'neutral'}
            className='uppercase tracking-wide px-1.5 py-0.5 text-xs font-medium'
          >
            {transport === 'webrtc' ? 'WebRTC' : 'WebSocket'}
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
        <FormField
          layout='vertical'
          label='Transport'
        >
          <Select
            value={transport}
            disabled={!webrtcEnabled}
            onValueChange={value =>
              onViewerSettingsChange({ transport: value === 'websocket' ? 'websocket' : 'webrtc' })
            }
          >
            <SelectTrigger className='w-full lg:max-w-100'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {webrtcEnabled ? <SelectItem value='webrtc'>WebRTC</SelectItem> : null}
              <SelectItem value='websocket'>WebSocket</SelectItem>
            </SelectContent>
          </Select>
        </FormField>

        <FormField
          label='Sound capture'
          description={viewerSettings.soundEnabled ? 'Request Android audio for this stream.' : 'Video-only stream.'}
          layout='horizontal'
        >
          <Switch
            className='relative touch:after:absolute touch:after:-inset-x-1 touch:after:-inset-y-3'
            checked={viewerSettings.soundEnabled}
            onCheckedChange={enabled => onViewerSettingsChange({ soundEnabled: Boolean(enabled) })}
            aria-label='Enable Android sound capture'
          />
        </FormField>

        <FormField
          layout='vertical'
          label='Preset'
        >
          <Select
            value={presetIsCustom ? 'custom' : viewerSettings.preset}
            onValueChange={value => {
              if (value !== 'custom') onViewerSettingsChange(viewerStreamingPresets[value])
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
        </FormField>

        <StreamingMetricBadges metrics={streamMetrics} />
        <StreamingDiagnostics metrics={streamMetrics} />

        <p className='text-xs text-foreground-muted touch:text-sm/5'>
          Encoder target {viewerSettings.bitrateMbps} Mbps is an upper quality target. Wire bitrate reflects current
          encoded traffic and is naturally lower on static screens. Interactive streaming always requests native
          resolution at 60 fps.
        </p>

        <ViewerBitrateField
          value={bitrateInput}
          onValueChange={onBitrateInputChange}
        />
      </div>
    </ToolSection>
  )
}
