'use client'

import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { IconChevronLeft, IconDeviceMobile } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { MobileViewerHeaderSlot } from '@/features/applications/viewer/display/display-viewer-shell/mobile-viewer-header-slot'
import { DisplayViewerVisibility } from '@/features/applications/viewer/display/display-viewer-visibility'
import { useDesktopViewport } from '@/hooks/use-desktop-viewport'
import { cn } from '@/lib/utils'
import { appResourceLabels, type AppResourceView } from '@/shared/model/applications/app-resource-links'
import { useViewerPlacement } from '@/shared/model/settings/viewer-placement-context'
import { PageBreadcrumbRow, PageHomeLink, pageBackButtonClassName } from '@/shared/ui/page/page-breadcrumbs'
import { AppViewerPlacementButton } from './app-viewer-placement-button'

type MobilePane = 'device' | 'section'

export const AppDeviceLayout = ({
  breadcrumbs,
  appName,
  children,
  viewer,
  view,
  contained = false,
  loading = false
}: {
  breadcrumbs: ReactNode
  appName?: string
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
  const deviceButton = useRef<HTMLButtonElement>(null)
  const exitButton = useRef<HTMLButtonElement>(null)
  const [headerSlot, setHeaderSlot] = useState<HTMLDivElement | null>(null)
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
    const focusTarget = pane === 'device' ? exitButton : deviceButton
    focusTarget.current?.focus({ preventScroll: true })
  }, [pane])

  // Grid placement keeps the viewer in the same DOM position across layout changes.
  return (
    <div
      data-mobile-pane={pane}
      className={cn(
        'app-device-layout grid w-full min-w-0 grid-cols-[minmax(0,1fr)] items-start gap-(--app-device-gap) [overflow-anchor:none] [reading-flow:grid-rows]',
        !stacked &&
          'lg:grid-cols-[minmax(0,1fr)_minmax(16rem,40%)] lg:grid-rows-[auto_minmax(0,1fr)] lg:[reading-flow:normal]',
        contained && pane === 'section' && 'max-lg:min-h-(--console-content-height)',
        contained && pane === 'section' && 'max-lg:grid-rows-[auto_minmax(0,1fr)]',
        contained && !stacked && 'lg:h-(--console-content-height)'
      )}
    >
      <PageBreadcrumbRow
        role='group'
        aria-label='App workspace view'
        className={cn(
          'col-start-1 row-start-1 mt-(--page-header-top-inset) px-(--page-inline-gutter)',
          pane === 'device' && 'max-lg:hidden'
        )}
      >
        <div className='flex min-w-0 flex-1'>
          <PageHomeLink className='lg:hidden' />
          <div className='hidden min-w-0 flex-1 lg:flex'>{breadcrumbs}</div>
        </div>
        <div className='hidden min-h-(--page-header-control-size) shrink-0 items-center lg:flex'>
          <AppViewerPlacementButton
            placement={placement}
            onPlacementChange={setPlacement}
            disabled={loading}
          />
        </div>
        <Button
          ref={deviceButton}
          type='button'
          size='sm'
          variant='ghost'
          className='min-h-11 lg:hidden'
          aria-controls={`${panelId}-device`}
          disabled={loading}
          onClick={() => selectPane('device')}
        >
          <IconDeviceMobile aria-hidden />
          Device
        </Button>
      </PageBreadcrumbRow>
      {pane === 'device' ? (
        <div className='col-start-1 row-start-1 h-(--mobile-device-header-height) min-w-0 px-(--page-inline-gutter) pt-(--page-header-top-inset) lg:hidden'>
          <PageBreadcrumbRow className='items-center'>
            <div className='flex min-w-0 flex-1 items-center gap-0.5'>
              <Button
                ref={exitButton}
                type='button'
                variant='ghost'
                size='icon-md'
                className={pageBackButtonClassName}
                aria-label={`Back to ${appResourceLabels[view]}`}
                onClick={() => selectPane('section')}
              >
                <IconChevronLeft aria-hidden />
              </Button>
              <h1 className='min-w-0 flex-1 truncate text-sm font-medium'>{appName ?? 'Device'}</h1>
            </div>
            <div
              ref={setHeaderSlot}
              className='min-w-0 max-w-[60%]'
            />
          </PageBreadcrumbRow>
        </div>
      ) : null}
      <div
        className={cn(
          'col-start-1 row-start-2 min-w-0',
          pane === 'device' && 'max-lg:hidden',
          contained && 'max-lg:flex max-lg:min-h-0 max-lg:self-stretch max-lg:flex-col',
          stacked && 'lg:row-start-3',
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
        <MobileViewerHeaderSlot.Provider value={headerSlot}>
          <DisplayViewerVisibility.Provider value={isDesktop === true || pane === 'device'}>
            {viewer}
          </DisplayViewerVisibility.Provider>
        </MobileViewerHeaderSlot.Provider>
      </aside>
    </div>
  )
}
