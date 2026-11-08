import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export const AppDeviceLayout = ({
  children,
  viewer,
  contained = false
}: {
  children: ReactNode
  viewer: ReactNode
  contained?: boolean
}) => (
  <div
    className={cn(
      'app-device-layout grid w-full min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,40%)]',
      contained && 'lg:h-[calc(100dvh-4rem)] lg:grid-rows-[minmax(0,1fr)] lg:overflow-hidden'
    )}
  >
    <div className={cn('min-w-0', contained && 'lg:h-full lg:min-h-0')}>{children}</div>
    <aside
      aria-label='Android device'
      className='app-device-pane flex min-w-0 items-start justify-center px-4 pb-4 lg:sticky lg:top-20 lg:pr-6'
    >
      {viewer}
    </aside>
  </div>
)
