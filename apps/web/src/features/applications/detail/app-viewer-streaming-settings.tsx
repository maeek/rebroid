'use client'

import { useMemo, useState } from 'react'
import { IconAdjustments } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { StreamingToolsSection } from '@/features/applications/viewer/tools/runtime-tools-panel/streaming/streaming-tools-section'
import { useApplicationViewerApp } from './application-viewer-context'

export const AppViewerStreamingSettings = () => {
  const [open, setOpen] = useState(false)
  const { viewerSettings, setViewerSettings, viewerStreamMetrics } = useApplicationViewerApp()
  const latestMetrics = useMemo(
    () =>
      Object.values(viewerStreamMetrics)
        .filter((value): value is NonNullable<typeof value> => Boolean(value))
        .sort((left, right) => right.collectedAt - left.collectedAt)[0] ?? null,
    [viewerStreamMetrics]
  )
  return (
    <Sheet
      open={open}
      onOpenChange={setOpen}
    >
      <SheetTrigger
        render={
          <Button
            size='sm'
            variant='ghost'
          />
        }
      >
        <IconAdjustments className='size-4' /> Streaming settings
      </SheetTrigger>
      <SheetContent className='w-[min(32rem,100vw)] overflow-y-auto sm:max-w-none'>
        <SheetHeader className='mb-6 pr-6'>
          <SheetTitle>Streaming settings</SheetTitle>
          <SheetDescription>Viewer quality, transport, and audio. Changes apply immediately.</SheetDescription>
        </SheetHeader>
        <StreamingToolsSection
          viewerSettings={viewerSettings}
          onViewerSettingsChange={setViewerSettings}
          streamMetrics={latestMetrics}
          className='border-0 bg-transparent p-0 shadow-none'
          hideHeader
        />
      </SheetContent>
    </Sheet>
  )
}
