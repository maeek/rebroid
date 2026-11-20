'use client'

import { useContext, useEffect, useEffectEvent, useState } from 'react'
import { IconAdjustments } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useStreamingDiagnosticSurfaces } from '@/features/applications/viewer/display/display-viewer-shell/display-viewer-context'
import {
  MobileViewerActionRows,
  mobileViewerActionRowClassName
} from '@/features/applications/viewer/display/viewer-control-bar/mobile/mobile-viewer-action-rows'
import { normalizeViewerSettings, type ViewerSettings } from '@/features/applications/viewer/settings/viewer-settings'
import { StreamingToolsSection } from '@/features/applications/viewer/tools/runtime-tools-panel/streaming/streaming-tools-section'
import { DateTimeValue } from '@/shared/ui/date-time-value'
import { useApplicationViewerApp } from './application-viewer-context'
import { ViewerStreamIssue, type ObservedStreamIssue } from './viewer-stream-issue'

const bitrateDebounceMs = 400
const streamSampleStaleMs = 5_000

const parseBitrateDraft = (value: string | null) => {
  if (!value?.trim()) return undefined
  const bitrate = Number(value)
  return Number.isFinite(bitrate) ? bitrate : undefined
}

export const AppViewerStreamingSettings = ({ streamIssue }: { streamIssue?: ObservedStreamIssue }) => {
  const [open, setOpen] = useState(false)
  const [bitrateDraft, setBitrateDraft] = useState<string | null>(null)
  const [selectedSurfaceId, setSelectedSurfaceId] = useState<string | null>(null)
  const [staleSampleTime, setStaleSampleTime] = useState<number | null>(null)
  const { app, viewerSettings, setViewerSettings, viewerStreamMetrics } = useApplicationViewerApp()
  const surfaces = useStreamingDiagnosticSurfaces() ?? []
  const mobileRow = useContext(MobileViewerActionRows)
  const showLabel = mobileRow || app.status !== 'running'
  let triggerClassName = 'size-6'
  if (showLabel) {
    triggerClassName = mobileRow
      ? mobileViewerActionRowClassName
      : 'h-6 gap-2 text-xs text-foreground-muted hover:bg-control-hover hover:text-foreground focus-visible:ring-inset dark:hover:bg-control-hover'
  }
  const issueSurface = surfaces.find(surface => surface.id === streamIssue?.surfaceId)
  const selectedSurface = surfaces.find(surface => surface.id === selectedSurfaceId) ?? issueSurface ?? surfaces[0]
  const sample = selectedSurface ? viewerStreamMetrics[selectedSurface.id] : undefined
  const metrics =
    sample && sample.sessionId === selectedSurface?.sessionId && sample.runtimeId === app.containerId
      ? sample.metrics
      : undefined
  const collectedAt = metrics?.collectedAt
  const capturedAt = collectedAt === undefined ? null : new Date(collectedAt)
  const captureTimestamp = capturedAt && Number.isFinite(capturedAt.getTime()) ? capturedAt.toISOString() : null

  useEffect(() => {
    if (!open || collectedAt === undefined) return
    const remaining = collectedAt + streamSampleStaleMs - Date.now()
    if (remaining <= 0) {
      setStaleSampleTime(collectedAt)
      return
    }
    const timer = window.setTimeout(() => setStaleSampleTime(collectedAt), remaining)
    return () => window.clearTimeout(timer)
  }, [collectedAt, open])
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
        if (!nextOpen) setSelectedSurfaceId(null)
        setOpen(nextOpen)
      }}
    >
      <Tooltip disabled={showLabel}>
        <TooltipTrigger asChild>
          <SheetTrigger
            render={
              <Button
                type='button'
                size={showLabel ? 'sm' : 'icon-sm'}
                variant={showLabel ? 'ghost' : 'secondary'}
                className={triggerClassName}
              />
            }
            aria-label={showLabel ? undefined : 'Streaming settings'}
          >
            <IconAdjustments
              aria-hidden='true'
              className='size-4'
            />
            {showLabel ? 'Streaming settings' : null}
          </SheetTrigger>
        </TooltipTrigger>
        <TooltipContent>Streaming settings</TooltipContent>
      </Tooltip>
      <SheetContent className='w-[min(32rem,100vw)] overflow-y-auto transform-gpu max-sm:p-4 sm:max-w-none'>
        <SheetHeader className='mb-5 pr-12 text-left'>
          <SheetTitle>Streaming settings</SheetTitle>
          <SheetDescription>
            Viewer quality, transport, and audio. Bitrate applies when you pause editing.
          </SheetDescription>
        </SheetHeader>
        {streamIssue && (
          <ViewerStreamIssue
            issue={streamIssue}
            displayName={issueSurface?.name}
          />
        )}
        {selectedSurface ? (
          <div className='mb-4 grid gap-2'>
            <FormField
              label='Metrics display'
              layout='vertical'
            >
              <Select
                value={selectedSurface.id}
                onValueChange={setSelectedSurfaceId}
              >
                <SelectTrigger className='w-full'>
                  <SelectValue>{selectedSurface.name}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {surfaces.map(surface => (
                    <SelectItem
                      key={surface.id}
                      value={surface.id}
                    >
                      {surface.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            {collectedAt === undefined ? (
              <p className='text-xs text-foreground-muted'>Collecting the first sample for this display…</p>
            ) : (
              <p className='flex flex-wrap items-center gap-x-1 text-xs text-foreground-muted'>
                {staleSampleTime === collectedAt ? 'Stale sample from' : 'Sample taken'}
                <DateTimeValue
                  value={captureTimestamp}
                  compact
                  showSeconds
                />
              </p>
            )}
          </div>
        ) : null}
        <StreamingToolsSection
          viewerSettings={viewerSettings}
          onViewerSettingsChange={updateSettings}
          bitrateInput={bitrateDraft ?? String(viewerSettings.bitrateMbps)}
          onBitrateInputChange={setBitrateDraft}
          streamMetrics={metrics}
          className='border-0 bg-transparent p-0 shadow-none'
          hideHeader
        />
      </SheetContent>
    </Sheet>
  )
}
