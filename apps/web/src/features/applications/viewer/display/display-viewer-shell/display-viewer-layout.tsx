import type { ReactNode, Ref, UIEventHandler } from 'react'
import { cn } from '@/lib/utils'

export const DisplayViewerLayout = ({
  tabs,
  children,
  className,
  scrollRef,
  onScroll
}: {
  tabs?: ReactNode
  children: ReactNode
  className?: string
  scrollRef?: Ref<HTMLDivElement>
  onScroll?: UIEventHandler<HTMLDivElement>
}) => (
  <div className={cn('relative flex h-svh w-full flex-col overflow-hidden bg-background', className)}>
    {tabs}
    <div
      data-display-workspace
      ref={scrollRef}
      className='relative min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden scroll-smooth p-2'
      onScroll={onScroll}
    >
      <div className='flex h-full w-max min-w-full flex-nowrap items-center justify-center gap-3 sm:gap-6'>
        {children}
      </div>
    </div>
  </div>
)
