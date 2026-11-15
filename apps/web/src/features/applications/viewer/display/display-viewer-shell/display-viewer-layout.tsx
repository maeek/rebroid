import type { ReactNode, Ref, UIEventHandler } from 'react'
import { cn } from '@/lib/utils'

export const DisplayViewerLayout = ({
  toolbar,
  switcher,
  compact = false,
  bottomControls,
  stageNotice,
  multipleDisplays = false,
  children,
  className,
  scrollRef,
  onScroll
}: {
  toolbar?: ReactNode
  switcher?: ReactNode
  compact?: boolean
  bottomControls?: ReactNode
  stageNotice?: ReactNode
  multipleDisplays?: boolean
  children: ReactNode
  className?: string
  scrollRef?: Ref<HTMLDivElement>
  onScroll?: UIEventHandler<HTMLDivElement>
}) => (
  <div className={cn('relative flex h-svh w-full flex-col overflow-hidden bg-background', className)}>
    {toolbar}
    <div className='relative min-h-0 flex-1'>
      {switcher ? <div className='absolute inset-x-2 top-2 z-10'>{switcher}</div> : null}
      {stageNotice ? (
        <div
          role='status'
          className='absolute end-2 top-2 z-10'
        >
          {stageNotice}
        </div>
      ) : null}
      <div
        data-display-workspace
        ref={scrollRef}
        className={cn(
          'relative h-full p-2',
          compact
            ? 'overflow-hidden'
            : 'snap-x snap-mandatory overflow-x-auto overflow-y-hidden motion-safe:scroll-smooth'
        )}
        onScroll={onScroll}
      >
        <div
          data-display-track
          className={cn(
            'mx-auto h-full',
            compact
              ? 'grid place-items-center'
              : cn('flex w-max flex-nowrap gap-3 sm:gap-6', multipleDisplays ? 'items-start' : 'items-center')
          )}
        >
          {children}
        </div>
      </div>
    </div>
    {bottomControls}
  </div>
)
