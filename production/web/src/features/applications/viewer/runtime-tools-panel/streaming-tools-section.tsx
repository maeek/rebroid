'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { IconSettings2 } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getViewerPlayerCapabilities } from '../viewer-player-capabilities'
import {
  isViewerPlayer,
  normalizeViewerSettings,
  viewerPlayerDefinitions,
  viewerStreamingPresets
} from '../viewer-settings'
import { ToolSection } from './tool-section'
import type { ViewerSettings, ViewerStreamingPreset } from '../viewer-settings'

const bitrateOptions = [2, 3, 5, 7, 10, 12, 16]
const fpsOptions = [15, 24, 30, 45, 60]
const maxSizeOptions = [0, 720, 1080, 1440, 1920]
const iFrameOptions = [1, 2, 5, 10]

const StreamingSettingRow = ({
  label,
  description,
  children
}: {
  label: string
  description?: string
  children: ReactNode
}) => (
  <div className='flex flex-col gap-3 border-b border-border/60 py-4 last:border-b-0 last:pb-0 first:pt-0 sm:flex-row sm:items-start sm:justify-between sm:gap-8'>
    <div className='min-w-0 sm:max-w-56'>
      <p className='text-xs font-semibold uppercase tracking-[0.08em] text-secondary-foreground'>{label}</p>
      {description ? <p className='mt-1 text-sm text-muted-foreground'>{description}</p> : null}
    </div>
    <div className='min-w-0 sm:flex sm:justify-end'>{children}</div>
  </div>
)

export const StreamingToolsSection = ({
  viewerSettings,
  onViewerSettingsChange
}: {
  viewerSettings: ViewerSettings
  onViewerSettingsChange: (settings: ViewerSettings) => void
}) => {
  const [streamingDialogOpen, setStreamingDialogOpen] = useState(false)
  const playerCapabilities = useMemo(() => getViewerPlayerCapabilities(), [])
  const selectedPlayer = viewerPlayerDefinitions.find(player => player.value === viewerSettings.player)
  const selectedCapability = playerCapabilities[viewerSettings.player]

  const updateSettings = (patch: Partial<ViewerSettings>) => {
    onViewerSettingsChange(normalizeViewerSettings({ ...viewerSettings, ...patch }))
  }

  const applyPreset = (preset: ViewerStreamingPreset) => {
    onViewerSettingsChange(normalizeViewerSettings({ ...viewerSettings, ...viewerStreamingPresets[preset] }))
  }

  const streamingSummary = useMemo(
    () =>
      `${selectedPlayer?.label ?? viewerSettings.player} • ${viewerSettings.bitrateMbps} Mbps • ${viewerSettings.maxFps} fps • ${viewerSettings.maxSize === 0 ? 'Fit frame' : `${viewerSettings.maxSize}px`}`,
    [
      selectedPlayer?.label,
      viewerSettings.bitrateMbps,
      viewerSettings.maxFps,
      viewerSettings.maxSize,
      viewerSettings.player
    ]
  )

  return (
    <>
      <ToolSection
        title='Streaming'
        description='Changes apply when the viewer reloads or starts a new stream.'
        icon={<IconSettings2 className='size-5' />}
        actions={
          <Button
            type='button'
            size='sm'
            variant='secondary'
            onClick={() => setStreamingDialogOpen(true)}
          >
            <IconSettings2 className='size-4' />
            Advanced
          </Button>
        }
      >
        <div className='grid gap-4'>
          <div className='grid grid-cols-3 gap-2 max-sm:grid-cols-1'>
            {(
              [
                ['bandwidth', 'Bandwidth'],
                ['balanced', 'Balanced'],
                ['quality', 'Quality']
              ] as Array<[ViewerStreamingPreset, string]>
            ).map(([preset, label]) => (
              <Button
                key={preset}
                type='button'
                variant={viewerSettings.preset === preset ? 'default' : 'outline'}
                onClick={() => applyPreset(preset)}
              >
                {label}
              </Button>
            ))}
          </div>
          <div className='text-[12px] text-muted-foreground'>{streamingSummary}</div>
        </div>
      </ToolSection>

      <Dialog
        open={streamingDialogOpen}
        onOpenChange={setStreamingDialogOpen}
      >
        <DialogContent className='max-w-[calc(100vw-2rem)] gap-0 overflow-hidden p-0 sm:max-w-3xl'>
          <DialogHeader className='gap-3 border-b border-border/70 px-6 py-5 pr-14 sm:px-7 sm:pr-16'>
            <div className='min-w-0'>
              <DialogTitle className='text-xl'>Streaming Settings</DialogTitle>
              <DialogDescription className='mt-1 max-w-2xl text-sm'>
                These options apply when the viewer reloads or starts a new stream.
              </DialogDescription>
            </div>
            <div className='w-fit rounded-full border border-border/70 bg-background/40 px-3 py-1 text-xs font-medium text-secondary-foreground'>
              {streamingSummary}
            </div>
          </DialogHeader>
          <div className='px-6 py-5 sm:px-7'>
            <StreamingSettingRow
              label='Renderer'
              description='Choose the browser playback path used for the next stream.'
            >
              <Select
                value={viewerSettings.player}
                onValueChange={value =>
                  updateSettings({
                    player: isViewerPlayer(value) ? value : 'mse'
                  })
                }
              >
                <SelectTrigger className='h-11 w-full sm:w-[20rem]'>
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
                        <span className='flex min-w-0 flex-col'>
                          <span className='flex items-center gap-2'>
                            {option.label}
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                                capability.supported
                                  ? 'bg-emerald-500/15 text-emerald-300'
                                  : 'bg-destructive/15 text-destructive'
                              }`}
                            >
                              {capability.supported ? 'available' : 'blocked'}
                            </span>
                          </span>
                          <span className='text-xs text-muted-foreground'>
                            {capability.reason ?? option.description}
                          </span>
                        </span>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
              {selectedCapability.reason ? (
                <p className='mt-2 text-xs text-muted-foreground'>{selectedCapability.reason}</p>
              ) : null}
            </StreamingSettingRow>

            <StreamingSettingRow label='Bitrate'>
              <Select
                value={String(viewerSettings.bitrateMbps)}
                onValueChange={value => updateSettings({ bitrateMbps: Number(value), preset: viewerSettings.preset })}
              >
                <SelectTrigger className='h-11 w-full sm:w-[20rem]'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {bitrateOptions.map(value => (
                    <SelectItem
                      key={value}
                      value={String(value)}
                    >
                      {value} Mbps
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </StreamingSettingRow>

            <StreamingSettingRow label='Max FPS'>
              <Select
                value={String(viewerSettings.maxFps)}
                onValueChange={value => updateSettings({ maxFps: Number(value), preset: viewerSettings.preset })}
              >
                <SelectTrigger className='h-11 w-full sm:w-[20rem]'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {fpsOptions.map(value => (
                    <SelectItem
                      key={value}
                      value={String(value)}
                    >
                      {value} fps
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </StreamingSettingRow>

            <StreamingSettingRow label='Max size'>
              <Select
                value={String(viewerSettings.maxSize)}
                onValueChange={value => updateSettings({ maxSize: Number(value), fitToFrame: value === '0' })}
              >
                <SelectTrigger className='h-11 w-full sm:w-[20rem]'>
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
            </StreamingSettingRow>

            <StreamingSettingRow label='I-frame'>
              <Select
                value={String(viewerSettings.iFrameInterval)}
                onValueChange={value =>
                  updateSettings({ iFrameInterval: Number(value), preset: viewerSettings.preset })
                }
              >
                <SelectTrigger className='h-11 w-full sm:w-[20rem]'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {iFrameOptions.map(value => (
                    <SelectItem
                      key={value}
                      value={String(value)}
                    >
                      {value}s
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </StreamingSettingRow>
          </div>
          <DialogFooter className='border-t border-border/70 px-6 py-4 sm:px-7'>
            <Button
              type='button'
              variant='secondary'
              onClick={() => setStreamingDialogOpen(false)}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
