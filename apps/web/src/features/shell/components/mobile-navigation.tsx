'use client'

import { useEffect, useState } from 'react'
import { IconDots, IconX } from '@tabler/icons-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer'
import { focusRingClassName } from '@/components/ui/surface'
import { cn } from '@/lib/utils'
import { useFeatureFlags } from '@/shared/model/features/feature-flags-context'
import { MobileAccount } from './navigation-controls/mobile-account'
import { ProtectedNavigation } from './protected-navigation'
import {
  appsNavigationItem,
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
  pollNavigation
}: {
  user: ShellUser
  isDesktop: boolean
  pollNavigation: boolean
}) => {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)
  const pathname = usePathname()
  const { isFeatureEnabled } = useFeatureFlags()
  const destinations = isFeatureEnabled('feature.workflows')
    ? [appsNavigationItem, workflowsNavigationItem]
    : [appsNavigationItem]

  useEffect(() => {
    if (isDesktop) setOpen(false)
  }, [isDesktop])

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  return (
    <nav
      data-mobile-shell-chrome
      aria-label='Mobile navigation'
      className='fixed inset-x-3 bottom-[calc(0.5rem+env(safe-area-inset-bottom))] z-40 mx-auto grid h-13 max-w-md auto-cols-fr grid-flow-col gap-1 rounded-overlay bg-surface-floating-control p-1 shadow-floating-control lg:hidden'
    >
      {destinations.map(({ href, Icon, name }) => {
        const isApps = href === appsNavigationItem.href
        const active =
          isNavigationDestinationActive(pathname, href) || (isApps && isNavigationDestinationActive(pathname, '/app'))
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
            {isApps ? 'Apps' : name}
          </Link>
        )
      })}
      <Drawer
        open={open}
        onOpenChange={setOpen}
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
            <div className='flex shrink-0 items-center justify-between gap-2 ps-5 pe-2'>
              <DrawerTitle
                aria-label='Navigation'
                className={styles.wordmark}
              >
                Rebroid
              </DrawerTitle>
              <DrawerDescription className='sr-only'>Navigate between apps and settings pages.</DrawerDescription>
              <Button
                type='button'
                variant='ghost'
                size='icon-md'
                className='size-11'
                aria-label='Close navigation'
                onClick={close}
              >
                <IconX
                  aria-hidden='true'
                  className='size-5'
                />
              </Button>
            </div>
            <div className='scrollbar-thin min-h-0 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]'>
              <ProtectedNavigation
                variant='drawer'
                initialUser={user}
                pollRecentApps={pollNavigation && open}
                onNavigate={close}
              />
              <MobileAccount
                user={user}
                pathname={pathname}
                onNavigate={close}
              />
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </nav>
  )
}
