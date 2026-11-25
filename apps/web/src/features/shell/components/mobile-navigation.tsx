'use client'

import { useEffect, useLayoutEffect, useRef, useState, useTransition } from 'react'
import { IconArrowLeft, IconChevronRight, IconDots, IconLoader2, IconX } from '@tabler/icons-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer'
import { focusRingClassName, Surface } from '@/components/ui/surface'
import { useBackLayer } from '@/hooks/use-back-layer'
import { afterClosingBackEntry } from '@/lib/navigation/back-layers'
import { cn } from '@/lib/utils'
import { useFeatureFlags } from '@/shared/model/features/feature-flags-context'
import { AccountAvatar } from './navigation-controls/account-details'
import { MobileAccount } from './navigation-controls/mobile-account'
import { ProtectedNavigation, type RecentAppsQuery } from './protected-navigation'
import {
  appsNavigationItem,
  canBrowseDevices,
  externalDevicesNavigationItem,
  isNavigationDestinationActive,
  workflowsNavigationItem
} from './protected-navigation-config'
import type { ShellUser } from './shell-user'
import styles from '@/shared/ui/branding/rebroid-wordmark.module.css'

const destinationClassName = cn(
  focusRingClassName,
  'group/destination flex min-h-11 min-w-0 touch-manipulation flex-col items-center justify-center gap-0.5 rounded-control text-xs leading-4 font-medium text-foreground-muted motion-safe:transition-colors hover:text-foreground aria-[current]:text-primary data-[popup-open]:text-primary'
)

const destinationIconClassName = cn(
  'grid h-6 w-10 shrink-0 place-items-center rounded-control',
  'group-hover/destination:bg-foreground/8 group-aria-[current]/destination:bg-primary/12',
  'group-data-[popup-open]/destination:bg-primary/12 motion-safe:transition-[background-color,scale]',
  'motion-safe:group-active/destination:scale-95'
)

export const MobileNavigation = ({
  user,
  isDesktop,
  pollNavigation,
  recentAppsQuery
}: {
  user: ShellUser
  isDesktop: boolean
  pollNavigation: boolean
  recentAppsQuery: RecentAppsQuery
}) => {
  const [open, setOpen] = useState(false)
  const [showAccount, setShowAccount] = useState(false)
  const [reserveRecentApps, setReserveRecentApps] = useState(false)
  const [pendingDestination, setPendingDestination] = useState<string>()
  const [isNavigating, startNavigation] = useTransition()
  const router = useRouter()
  const accountEntry = useRef<HTMLButtonElement>(null)
  const accountBack = useRef<HTMLButtonElement>(null)
  const drawerScroll = useRef<HTMLDivElement>(null)
  const close = () => setOpen(false)
  const pathname = usePathname()
  const { isFeatureEnabled } = useFeatureFlags()
  const destinations = [{ ...appsNavigationItem, name: 'Apps' }]
  if (canBrowseDevices(user, isFeatureEnabled('feature.external-devices')))
    destinations.push({ ...externalDevicesNavigationItem, name: 'Devices' })
  if (isFeatureEnabled('feature.workflows')) destinations.push(workflowsNavigationItem)

  useBackLayer(open && showAccount, () => setShowAccount(false))

  const navigate = (href: string, label: string) => {
    setPendingDestination(label)
    close()
    afterClosingBackEntry(() => startNavigation(() => router.push(href)))
  }

  useEffect(() => {
    if (isDesktop) setOpen(false)
  }, [isDesktop])

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  useLayoutEffect(() => {
    const scrollRegion = drawerScroll.current
    if (scrollRegion) scrollRegion.scrollTop = 0
    const target = showAccount ? accountBack : accountEntry
    target.current?.focus({ preventScroll: true })
  }, [showAccount])

  return (
    <nav
      data-mobile-shell-chrome
      aria-label='Mobile navigation'
      className='fixed inset-x-3 bottom-[calc(0.5rem+env(safe-area-inset-bottom))] z-40 mx-auto grid h-13 max-w-md auto-cols-fr grid-flow-col gap-1 rounded-overlay bg-surface-floating-control p-1 shadow-floating-control lg:hidden'
    >
      {isNavigating && pendingDestination ? (
        <Surface
          level='floating'
          role='status'
          className='pointer-events-none absolute right-0 bottom-full mb-2 flex max-w-full items-center gap-2 px-3 py-2 text-sm'
        >
          <IconLoader2
            aria-hidden='true'
            className='size-4 shrink-0 motion-safe:animate-spin'
          />
          <span className='truncate'>Opening {pendingDestination}…</span>
        </Surface>
      ) : null}
      {destinations.map(({ href, Icon, name }) => {
        const active = isNavigationDestinationActive(pathname, href)
        const current = pathname === href ? 'page' : 'location'

        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? current : undefined}
            className={destinationClassName}
          >
            <span
              data-slot='mobile-navigation-icon'
              aria-hidden='true'
              className={destinationIconClassName}
            >
              <Icon className='size-5' />
            </span>
            {name}
          </Link>
        )
      })}
      <Drawer
        open={open}
        onOpenChange={(nextOpen, event) => {
          if (!nextOpen && event.reason === 'close-watcher' && showAccount) {
            event.cancel()
            setShowAccount(false)
            return
          }
          if (nextOpen) {
            setShowAccount(false)
            setReserveRecentApps(pollNavigation && recentAppsQuery.data === undefined)
            if (pollNavigation) void recentAppsQuery.mutate()
          }
          setOpen(nextOpen)
        }}
      >
        <DrawerTrigger
          type='button'
          className={destinationClassName}
        >
          <span
            data-slot='mobile-navigation-icon'
            aria-hidden='true'
            className={destinationIconClassName}
          >
            <IconDots className='size-5' />
          </span>
          More
        </DrawerTrigger>
        <DrawerContent className='max-h-[85dvh] border-0 bg-surface-navigation lg:hidden'>
          <div className='flex min-h-0 flex-col'>
            <div className={cn('flex shrink-0 items-center gap-2 pe-2', showAccount ? 'ps-2' : 'ps-5')}>
              {showAccount ? (
                <Button
                  ref={accountBack}
                  type='button'
                  variant='ghost'
                  size='icon-md'
                  className='size-11'
                  aria-label='Back to More'
                  onClick={() => setShowAccount(false)}
                >
                  <IconArrowLeft
                    className='size-5'
                    aria-hidden='true'
                  />
                </Button>
              ) : null}
              <DrawerTitle
                aria-label={showAccount ? undefined : 'Navigation'}
                className={showAccount ? undefined : styles.wordmark}
              >
                {showAccount ? 'Account' : 'Rebroid'}
              </DrawerTitle>
              <DrawerDescription className='sr-only'>
                {showAccount
                  ? 'Manage your preferences, theme, and sign-in.'
                  : 'Navigate between apps and settings pages.'}
              </DrawerDescription>
              <Button
                type='button'
                variant='ghost'
                size='icon-md'
                className='ml-auto size-11'
                aria-label='Close navigation'
                onClick={close}
              >
                <IconX
                  aria-hidden='true'
                  className='size-5'
                />
              </Button>
            </div>
            <div
              ref={drawerScroll}
              className='scrollbar-thin min-h-0 overflow-y-auto transform-gpu overscroll-contain pb-[env(safe-area-inset-bottom)]'
            >
              <div hidden={showAccount}>
                <div className='px-4 pt-1'>
                  <Button
                    ref={accountEntry}
                    type='button'
                    variant='secondary'
                    className='h-auto min-h-14 w-full justify-start px-2.5 text-left'
                    aria-label={user.name ? `Account: ${user.name}` : 'Account'}
                    onClick={() => setShowAccount(true)}
                  >
                    <AccountAvatar user={user} />
                    <span className='flex min-w-0 flex-1 flex-col'>
                      {user.name ? <span className='truncate'>{user.name}</span> : null}
                      <span className={cn(user.name && 'text-xs text-foreground-muted')}>Account</span>
                    </span>
                    <IconChevronRight
                      className='size-4 text-foreground-muted'
                      aria-hidden='true'
                    />
                  </Button>
                </div>
                <ProtectedNavigation
                  variant='drawer'
                  initialUser={user}
                  recentAppsQuery={recentAppsQuery}
                  reserveRecentApps={reserveRecentApps}
                  onNavigate={navigate}
                  onClose={close}
                />
              </div>
              {showAccount ? (
                <MobileAccount
                  user={user}
                  pathname={pathname}
                  onNavigate={navigate}
                />
              ) : null}
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </nav>
  )
}
