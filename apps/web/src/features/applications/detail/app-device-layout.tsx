'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { useViewerPlacement } from '@/shared/model/settings/viewer-placement-context'
import { AppViewerPlacementMenu } from './app-viewer-placement-menu'

export const AppDeviceLayout = ({
  breadcrumbs,
  children,
  viewer,
  contained = false,
  loading = false
}: {
  breadcrumbs: ReactNode
  children: ReactNode
  viewer: ReactNode
  contained?: boolean
  loading?: boolean
}) => {
  const { placement, setPlacement } = useViewerPlacement()
  // Grid placement keeps the viewer in the same DOM position across layout changes.
  const stacked = placement === 'top'

  return (
    <div
      className={cn(
        'app-device-layout grid w-full min-w-0 items-start gap-6 [overflow-anchor:none]',
        stacked
          ? 'grid-cols-[minmax(0,1fr)] [reading-flow:grid-rows]'
          : 'lg:grid-cols-[minmax(0,1fr)_minmax(16rem,40%)] lg:grid-rows-[auto_minmax(0,1fr)]',
        contained && !stacked && 'lg:h-[calc(100dvh-4rem)]'
      )}
    >
      <div className='col-start-1 row-start-1 flex min-w-0 items-start gap-2 px-6 max-sm:px-4'>
        <div className='min-w-0 flex-1'>{breadcrumbs}</div>
        <AppViewerPlacementMenu
          placement={placement}
          onPlacementChange={setPlacement}
          disabled={loading}
        />
      </div>
      <div
        className={cn(
          'col-start-1 min-w-0',
          stacked ? 'row-start-3' : 'row-start-2',
          contained && (stacked ? 'lg:h-[calc(100dvh-4rem)] lg:min-h-0' : 'lg:h-full lg:min-h-0')
        )}
      >
        {children}
      </div>
      <aside
        aria-label='Android device'
        className={cn(
          'app-device-pane flex min-w-0 items-start justify-center px-4',
          stacked
            ? 'col-start-1 row-start-2'
            : 'row-start-3 lg:sticky lg:top-20 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:mt-4 lg:pr-6'
        )}
        data-viewer-placement={stacked ? 'top' : undefined}
      >
        {viewer}
      </aside>
    </div>
  )
}
