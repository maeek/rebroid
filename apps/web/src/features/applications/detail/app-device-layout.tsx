'use client'

import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { IconDeviceMobile } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { DisplayViewerVisibility } from '@/features/applications/viewer/display/display-viewer-visibility'
import { useDesktopViewport } from '@/hooks/use-desktop-viewport'
import { cn } from '@/lib/utils'
import { appResourceLabels, type AppResourceView } from '@/shared/model/applications/app-resource-links'
import { useViewerPlacement } from '@/shared/model/settings/viewer-placement-context'
import { AppViewerPlacementButton } from './app-viewer-placement-button'

type MobilePane = 'device' | 'section'

export const AppDeviceLayout = ({
  breadcrumbs,
  children,
  viewer,
  view,
  contained = false,
  loading = false
}: {
  breadcrumbs: ReactNode
  children: ReactNode
  viewer: ReactNode
  view: AppResourceView
  contained?: boolean
  loading?: boolean
}) => {
  const { placement, setPlacement } = useViewerPlacement()
  const isDesktop = useDesktopViewport()
  const panelId = useId()
  const [activePane, setActivePane] = useState<{ view: AppResourceView; pane: MobilePane }>({ view, pane: 'section' })
  const pane = activePane.view === view ? activePane.pane : 'section'
  if (activePane.view !== view) setActivePane({ view, pane: 'section' })
  const sectionScroll = useRef<Partial<Record<AppResourceView, number>>>({})
  const deviceScroll = useRef(0)
  const restoreScroll = useRef<number | null>(null)
  const stacked = placement === 'top'

  const selectPane = (next: MobilePane) => {
    if (next === pane) return
    if (pane === 'device') deviceScroll.current = window.scrollY
    else sectionScroll.current[view] = window.scrollY
    restoreScroll.current = next === 'device' ? deviceScroll.current : (sectionScroll.current[view] ?? 0)
    setActivePane({ view, pane: next })
  }

  useLayoutEffect(() => {
    if (restoreScroll.current === null) return
    window.scrollTo({ top: restoreScroll.current, behavior: 'instant' })
    restoreScroll.current = null
  }, [pane])

  // Grid placement keeps the viewer in the same DOM position across layout changes.
  return (
    <div
      className={cn(
        'app-device-layout grid w-full min-w-0 grid-cols-[minmax(0,1fr)] items-start gap-(--app-device-gap) [overflow-anchor:none] [reading-flow:grid-rows]',
        !stacked &&
          'lg:grid-cols-[minmax(0,1fr)_minmax(16rem,40%)] lg:grid-rows-[auto_minmax(0,1fr)] lg:[reading-flow:normal]',
        contained && pane === 'section' && 'max-lg:min-h-(--console-content-height)',
        contained && pane === 'section' && 'max-lg:grid-rows-[auto_auto_minmax(0,1fr)]',
        contained && !stacked && 'lg:h-(--console-content-height)'
      )}
    >
      <div className='col-start-1 row-start-1 mt-(--page-header-top-inset) flex min-h-(--page-header-control-size) min-w-0 items-center gap-2 px-6 max-sm:px-4'>
        <div className='min-w-0 flex-1'>{breadcrumbs}</div>
        <AppViewerPlacementButton
          placement={placement}
          onPlacementChange={setPlacement}
          disabled={loading}
        />
      </div>
      <div
        role='group'
        aria-label='App workspace view'
        className='sticky top-(--console-top-inset) z-20 col-start-1 row-start-2 flex min-w-0 flex-wrap gap-1 bg-background px-6 py-1 max-sm:px-4 lg:hidden'
      >
        <Button
          type='button'
          size='sm'
          variant={pane === 'section' ? 'secondary' : 'ghost'}
          aria-controls={`${panelId}-section`}
          aria-pressed={pane === 'section'}
          disabled={loading}
          onClick={() => selectPane('section')}
        >
          {appResourceLabels[view]}
        </Button>
        <Button
          type='button'
          size='sm'
          variant={pane === 'device' ? 'secondary' : 'ghost'}
          aria-controls={`${panelId}-device`}
          aria-pressed={pane === 'device'}
          disabled={loading}
          onClick={() => selectPane('device')}
        >
          <IconDeviceMobile aria-hidden />
          Device
        </Button>
      </div>
      <div
        id={`${panelId}-section`}
        className={cn(
          'col-start-1 row-start-3 min-w-0',
          pane === 'device' && 'max-lg:hidden',
          contained && 'max-lg:flex max-lg:min-h-0 max-lg:self-stretch max-lg:flex-col',
          !stacked && 'lg:row-start-2',
          contained && (stacked ? 'lg:h-(--console-content-height) lg:min-h-0' : 'lg:h-full lg:min-h-0')
        )}
      >
        {children}
      </div>
      <aside
        id={`${panelId}-device`}
        aria-label='Android device'
        className={cn(
          'app-device-pane col-start-1 row-start-3 flex min-w-0 items-start justify-center px-4',
          pane === 'section' && 'max-lg:hidden',
          stacked ? 'lg:row-start-2' : 'lg:sticky lg:top-4 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:mt-4 lg:pr-6'
        )}
        data-viewer-placement={stacked ? 'top' : undefined}
      >
        <DisplayViewerVisibility.Provider value={isDesktop === true || pane === 'device'}>
          {viewer}
        </DisplayViewerVisibility.Provider>
      </aside>
    </div>
  )
}
