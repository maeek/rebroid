'use client'

import { useMemo, useState } from 'react'
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
import { Switch } from '@/components/ui/switch'
import { normalizeViewerSettings, viewerStreamingPresets } from '../viewer-settings'
import { RuntimeToolField } from './field'
import { ToolSection } from './tool-section'
import type { ViewerSettings, ViewerStreamingPreset } from '../viewer-settings'

const bitrateOptions = [2, 3, 5, 7, 10, 12, 16]
const fpsOptions = [15, 24, 30, 45, 60]
const maxSizeOptions = [0, 720, 1080, 1440, 1920]
const iFrameOptions = [1, 2, 5, 10]

export const StreamingToolsSection = ({
  viewerSettings,
  onViewerSettingsChange
}: {
  viewerSettings: ViewerSettings
  onViewerSettingsChange: (settings: ViewerSettings) => void
}) => {
  const [streamingDialogOpen, setStreamingDialogOpen] = useState(false)

  const updateSettings = (patch: Partial<ViewerSettings>) => {
    onViewerSettingsChange(normalizeViewerSettings({ ...viewerSettings, ...patch }))
  }

  const applyPreset = (preset: ViewerStreamingPreset) => {
    onViewerSettingsChange(normalizeViewerSettings({ ...viewerSettings, ...viewerStreamingPresets[preset] }))
  }

  const streamingSummary = useMemo(
    () =>
      `${viewerSettings.bitrateMbps} Mbps • ${viewerSettings.maxFps} fps • ${viewerSettings.maxSize === 0 ? 'Fit frame' : `${viewerSettings.maxSize}px`}`,
    [viewerSettings.bitrateMbps, viewerSettings.maxFps, viewerSettings.maxSize]
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
        <DialogContent className='sm:max-w-2xl'>
          <DialogHeader>
            <DialogTitle>Streaming Settings</DialogTitle>
            <DialogDescription>These options apply when the viewer reloads or starts a new stream.</DialogDescription>
          </DialogHeader>
          <div className='grid gap-4'>
            <div className='flex items-center justify-between rounded-md border border-border/60 bg-background/25 px-4 py-3'>
              <div>
                <div className='text-sm font-medium text-foreground'>Sound</div>
                <div className='text-xs text-secondary-foreground'>Play device audio when the viewer reconnects.</div>
              </div>
              <Switch
                checked={viewerSettings.soundEnabled}
                onCheckedChange={soundEnabled => updateSettings({ soundEnabled })}
              />
            </div>
            <div className='grid grid-cols-2 gap-3 max-sm:grid-cols-1'>
              <RuntimeToolField label='Bitrate'>
                <Select
                  value={String(viewerSettings.bitrateMbps)}
                  onValueChange={value => updateSettings({ bitrateMbps: Number(value), preset: viewerSettings.preset })}
                >
                  <SelectTrigger>
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
              </RuntimeToolField>
              <RuntimeToolField label='Max FPS'>
                <Select
                  value={String(viewerSettings.maxFps)}
                  onValueChange={value => updateSettings({ maxFps: Number(value), preset: viewerSettings.preset })}
                >
                  <SelectTrigger>
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
              </RuntimeToolField>
              <RuntimeToolField label='Max size'>
                <Select
                  value={String(viewerSettings.maxSize)}
                  onValueChange={value => updateSettings({ maxSize: Number(value), fitToFrame: value === '0' })}
                >
                  <SelectTrigger>
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
              </RuntimeToolField>
              <RuntimeToolField label='I-frame'>
                <Select
                  value={String(viewerSettings.iFrameInterval)}
                  onValueChange={value =>
                    updateSettings({ iFrameInterval: Number(value), preset: viewerSettings.preset })
                  }
                >
                  <SelectTrigger>
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
              </RuntimeToolField>
            </div>
          </div>
          <DialogFooter>
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
