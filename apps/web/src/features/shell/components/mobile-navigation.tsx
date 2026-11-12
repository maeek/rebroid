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
import { NavigationControls } from './navigation-controls/navigation-controls'
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
  'flex min-h-11 min-w-0 touch-manipulation flex-col items-center justify-center gap-0.5 rounded-control text-xs leading-4 font-medium text-foreground-muted transition-colors hover:bg-control-hover hover:text-foreground aria-[current]:bg-accent aria-[current]:text-accent-foreground'
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

  return (
    <>
      <header className='fixed inset-x-0 top-0 z-50 flex h-(--console-top-inset) items-center justify-between gap-2 bg-background/90 pt-[env(safe-area-inset-top)] ps-4 pe-2 backdrop-blur-xl sm:pe-4 lg:hidden'>
        <Link
          href='/'
          className='min-w-0 truncate text-lg font-bold'
        >
          <span className={styles.wordmark}>Rebroid</span>
        </Link>
        <NavigationControls
          user={user}
          placement='header'
          polling={pollNavigation}
        />
      </header>
      <nav
        aria-label='Mobile navigation'
        className='fixed inset-x-0 bottom-0 z-40 grid h-(--console-bottom-inset) auto-cols-fr grid-flow-col gap-1 border-t border-surface-border bg-surface-navigation p-1 pb-[calc(0.25rem+env(safe-area-inset-bottom))] lg:hidden'
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
              <Icon
                aria-hidden='true'
                className='size-5'
              />
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
            className={cn(destinationClassName, 'data-[popup-open]:bg-accent data-[popup-open]:text-accent-foreground')}
          >
            <IconDots
              aria-hidden='true'
              className='size-5'
            />
            More
          </DrawerTrigger>
          <DrawerContent className='max-h-[85dvh] border-0 bg-surface-navigation lg:hidden'>
            <div className='flex min-h-0 flex-col pb-[env(safe-area-inset-bottom)]'>
              <div className='flex shrink-0 items-center justify-between gap-2 ps-5 pe-2'>
                <DrawerTitle>Navigation</DrawerTitle>
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
              <div className='scrollbar-thin min-h-0 overflow-y-auto overscroll-contain'>
                <ProtectedNavigation
                  variant='drawer'
                  initialUser={user}
                  pollRecentApps={pollNavigation && open}
                  onNavigate={close}
                />
              </div>
            </div>
          </DrawerContent>
        </Drawer>
      </nav>
    </>
  )
}
