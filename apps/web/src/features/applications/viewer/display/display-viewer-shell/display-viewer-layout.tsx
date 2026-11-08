import type { ReactNode, Ref, UIEventHandler } from 'react'
import { cn } from '@/lib/utils'

export const DisplayViewerLayout = ({
  tabs,
  controls,
  children,
  className,
  scrollRef,
  onScroll
}: {
  tabs?: ReactNode
  controls?: ReactNode
  children: ReactNode
  className?: string
  scrollRef?: Ref<HTMLDivElement>
  onScroll?: UIEventHandler<HTMLDivElement>
}) => (
  <div className={cn('relative flex h-screen w-screen flex-col overflow-hidden bg-background', className)}>
    {tabs}
    <div
      ref={scrollRef}
      className='min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden scroll-smooth px-2 py-2 sm:px-6 sm:py-3'
      onScroll={onScroll}
    >
      <div className='flex h-full w-max min-w-full flex-nowrap items-center justify-center gap-3 sm:gap-6'>
        {children}
      </div>
    </div>
    {controls ? <div className='shrink-0 px-1 pb-2 sm:px-3 sm:pb-3'>{controls}</div> : null}
  </div>
)
