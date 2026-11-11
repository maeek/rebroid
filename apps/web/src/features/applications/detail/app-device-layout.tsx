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
        'app-device-layout grid w-full min-w-0 grid-cols-[minmax(0,1fr)] items-start gap-6 [overflow-anchor:none] [reading-flow:grid-rows]',
        !stacked &&
          'lg:grid-cols-[minmax(0,1fr)_minmax(16rem,40%)] lg:grid-rows-[auto_minmax(0,1fr)] lg:[reading-flow:normal]',
        contained && !stacked && 'lg:h-(--console-content-height)'
      )}
    >
      <div className='col-start-1 row-start-1 mt-(--page-header-top-inset) flex min-h-(--page-header-control-size) min-w-0 items-center gap-2 px-6 max-sm:px-4'>
        <div className='min-w-0 flex-1'>{breadcrumbs}</div>
        <AppViewerPlacementMenu
          placement={placement}
          onPlacementChange={setPlacement}
          disabled={loading}
        />
      </div>
      <div
        className={cn(
          'col-start-1 row-start-3 min-w-0',
          !stacked && 'lg:row-start-2',
          contained && (stacked ? 'lg:h-(--console-content-height) lg:min-h-0' : 'lg:h-full lg:min-h-0')
        )}
      >
        {children}
      </div>
      <aside
        aria-label='Android device'
        className={cn(
          'app-device-pane col-start-1 row-start-2 flex min-w-0 items-start justify-center px-4 max-lg:[--app-viewer-height:calc(100svh-9rem)]',
          !stacked && 'lg:sticky lg:top-4 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:mt-4 lg:pr-6'
        )}
        data-viewer-placement={stacked ? 'top' : undefined}
      >
        {viewer}
      </aside>
    </div>
  )
}
