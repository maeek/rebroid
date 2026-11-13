'use client'

import { useEffect, useEffectEvent, useMemo, useState } from 'react'
import { IconAdjustments } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { normalizeViewerSettings, type ViewerSettings } from '@/features/applications/viewer/settings/viewer-settings'
import { StreamingToolsSection } from '@/features/applications/viewer/tools/runtime-tools-panel/streaming/streaming-tools-section'
import { useApplicationViewerApp } from './application-viewer-context'
import { ViewerStreamIssue, type ObservedStreamIssue } from './viewer-stream-issue'

const bitrateDebounceMs = 400

const parseBitrateDraft = (value: string | null) => {
  if (!value?.trim()) return undefined
  const bitrate = Number(value)
  return Number.isFinite(bitrate) ? bitrate : undefined
}

export const AppViewerStreamingSettings = ({ streamIssue }: { streamIssue?: ObservedStreamIssue }) => {
  const [open, setOpen] = useState(false)
  const [bitrateDraft, setBitrateDraft] = useState<string | null>(null)
  const { viewerSettings, setViewerSettings, viewerStreamMetrics } = useApplicationViewerApp()
  const latestMetrics = useMemo(
    () =>
      Object.values(viewerStreamMetrics)
        .filter((value): value is NonNullable<typeof value> => Boolean(value))
        .sort((left, right) => right.collectedAt - left.collectedAt)[0] ?? null,
    [viewerStreamMetrics]
  )
  const applyBitrate = useEffectEvent((bitrateMbps: number) => {
    setViewerSettings(current => {
      const next = normalizeViewerSettings({ ...current, bitrateMbps })
      return next.bitrateMbps === current.bitrateMbps ? current : next
    })
    setBitrateDraft(null)
  })

  useEffect(() => {
    const bitrate = parseBitrateDraft(bitrateDraft)
    if (bitrate === undefined) return
    const timer = window.setTimeout(() => applyBitrate(bitrate), bitrateDebounceMs)
    return () => window.clearTimeout(timer)
  }, [bitrateDraft])

  const updateSettings = (patch: Partial<ViewerSettings>) => {
    const bitrateMbps = patch.bitrateMbps ?? parseBitrateDraft(bitrateDraft)
    setViewerSettings(current =>
      normalizeViewerSettings({
        ...current,
        ...patch,
        bitrateMbps: bitrateMbps ?? current.bitrateMbps
      })
    )
    setBitrateDraft(null)
  }

  return (
    <Sheet
      open={open}
      onOpenChange={nextOpen => {
        if (!nextOpen && parseBitrateDraft(bitrateDraft) === undefined) setBitrateDraft(null)
        setOpen(nextOpen)
      }}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <SheetTrigger
            render={
              <Button
                type='button'
                size='icon-sm'
                variant='secondary'
                className='size-6'
              />
            }
            aria-label='Streaming settings'
          >
            <IconAdjustments className='size-4' />
          </SheetTrigger>
        </TooltipTrigger>
        <TooltipContent>Streaming settings</TooltipContent>
      </Tooltip>
      <SheetContent className='w-[min(32rem,100vw)] overflow-y-auto max-sm:p-4 sm:max-w-none'>
        <SheetHeader className='mb-5 pr-12 text-left'>
          <SheetTitle>Streaming settings</SheetTitle>
          <SheetDescription>
            Viewer quality, transport, and audio. Bitrate applies when you pause editing.
          </SheetDescription>
        </SheetHeader>
        {streamIssue && <ViewerStreamIssue issue={streamIssue} />}
        <StreamingToolsSection
          viewerSettings={viewerSettings}
          onViewerSettingsChange={updateSettings}
          bitrateInput={bitrateDraft ?? String(viewerSettings.bitrateMbps)}
          onBitrateInputChange={setBitrateDraft}
          streamMetrics={latestMetrics}
          className='border-0 bg-transparent p-0 shadow-none'
          hideHeader
        />
      </SheetContent>
    </Sheet>
  )
}
