'use client'

import { useState, type ComponentProps, type ReactElement } from 'react'
import { PreviewCard } from '@base-ui/react/preview-card'
import { floatingLayerClassName } from '@/components/ui/surface'
import { useApplicationSnapshot } from '@/shared/model/applications/use-application-snapshot'
import { DateTimeValue } from '@/shared/ui/date-time-value'

type PreviewPosition = Pick<ComponentProps<typeof PreviewCard.Positioner>, 'anchor' | 'side' | 'sideOffset'>

export const AppSnapshotPreview = ({
  appId,
  appName,
  suppressed,
  children,
  ...position
}: {
  appId: string
  appName: string
  suppressed: boolean
  children: ReactElement
} & PreviewPosition) => {
  const [open, setOpen] = useState(false)
  const [wasSuppressed, setWasSuppressed] = useState(suppressed)
  if (wasSuppressed !== suppressed) {
    setWasSuppressed(suppressed)
    setOpen(false)
  }
  const visible = open && !suppressed

  return (
    <PreviewCard.Root
      open={visible}
      onOpenChange={next => setOpen(next && !suppressed)}
    >
      <PreviewCard.Trigger
        delay={350}
        render={children}
      />
      {visible ? (
        <AppSnapshotPopup
          appId={appId}
          appName={appName}
          {...position}
        />
      ) : null}
    </PreviewCard.Root>
  )
}

const AppSnapshotPopup = ({
  appId,
  appName,
  ...position
}: {
  appId: string
  appName: string
} & PreviewPosition) => {
  const { snapshot, pending } = useApplicationSnapshot(appId)

  return (
    <PreviewCard.Portal>
      <PreviewCard.Positioner
        align='start'
        sideOffset={8}
        className={floatingLayerClassName}
        {...position}
      >
        <PreviewCard.Popup
          data-slot='app-snapshot-preview'
          className='grid h-[min(15rem,var(--available-height,100dvh))] w-[min(13rem,var(--available-width,100dvw))] grid-rows-[minmax(0,1fr)_2rem] overflow-hidden rounded-overlay border border-surface-border bg-surface-elevated shadow-floating'
        >
          <div
            aria-busy={pending || undefined}
            className='grid min-h-0 place-items-center overflow-hidden bg-surface-band text-center text-xs text-foreground-muted'
          >
            {snapshot ? (
              <img
                src={snapshot.dataUrl}
                alt={`Latest screenshot of ${appName}`}
                className='block size-full object-contain'
              />
            ) : (
              <span
                className='px-2'
                role='status'
              >
                {pending ? 'Loading preview…' : 'Preview unavailable'}
              </span>
            )}
          </div>
          {snapshot ? (
            <div className='flex min-w-0 flex-wrap items-center justify-center gap-x-1 px-2 text-xs text-foreground-muted'>
              Captured{' '}
              <DateTimeValue
                value={snapshot.capturedAt}
                compact
              />
            </div>
          ) : null}
        </PreviewCard.Popup>
      </PreviewCard.Positioner>
    </PreviewCard.Portal>
  )
}
