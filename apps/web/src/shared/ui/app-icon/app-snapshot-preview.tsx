'use client'

import { useState, type ComponentProps, type ReactElement } from 'react'
import { PreviewCard } from '@base-ui/react/preview-card'
import { floatingLayerClassName } from '@/components/ui/surface'
import { useApplicationSnapshot } from '@/shared/model/applications/use-application-snapshot'

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
          aria-busy={pending || undefined}
          className='overflow-hidden rounded-overlay shadow-floating'
        >
          {snapshot ? (
            <img
              src={snapshot.dataUrl}
              alt={`Latest screenshot of ${appName}`}
              className='block h-auto max-h-[min(24rem,var(--available-height,100dvh))] w-auto max-w-[min(18rem,var(--available-width,100dvw))]'
            />
          ) : (
            <div
              className='rounded-control bg-surface-elevated px-3 py-2 text-xs text-foreground-muted'
              role='status'
            >
              {pending ? 'Loading preview…' : 'Preview unavailable'}
            </div>
          )}
        </PreviewCard.Popup>
      </PreviewCard.Positioner>
    </PreviewCard.Portal>
  )
}
