'use client'

import { useEffect, useState } from 'react'
import { IconMenu2, IconX } from '@tabler/icons-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer'
import { NavigationControls } from './navigation-controls/navigation-controls'
import { ProtectedNavigation } from './protected-navigation'
import type { ShellUser } from './shell-user'
import styles from '@/shared/ui/branding/rebroid-wordmark.module.css'

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

  useEffect(() => {
    if (isDesktop) setOpen(false)
  }, [isDesktop])

  return (
    <header className='fixed inset-x-0 top-0 z-50 flex h-(--console-top-inset) items-center justify-between gap-2 bg-background/90 px-2 backdrop-blur-xl sm:px-4 lg:hidden'>
      <div className='flex min-w-0 flex-1 items-center gap-2 sm:gap-4'>
        <Drawer
          open={open}
          onOpenChange={setOpen}
        >
          <DrawerTrigger asChild>
            <Button
              type='button'
              variant='ghost'
              size='icon-md'
              aria-label='Open navigation'
            >
              <IconMenu2 className='size-5' />
            </Button>
          </DrawerTrigger>
          <DrawerContent className='border-0 bg-surface-navigation lg:hidden'>
            <div className='flex max-h-[calc(85svh-1.5rem)] min-h-0 flex-col pb-[env(safe-area-inset-bottom)]'>
              <div className='flex shrink-0 items-center justify-between gap-2 px-5 pt-3'>
                <DrawerTitle>Navigation</DrawerTitle>
                <DrawerDescription className='sr-only'>Navigate between apps and settings pages.</DrawerDescription>
                <Button
                  type='button'
                  variant='ghost'
                  size='icon-md'
                  aria-label='Close navigation'
                  onClick={close}
                >
                  <IconX className='size-5' />
                </Button>
              </div>
              <div className='scrollbar-thin min-h-0 overflow-y-auto overscroll-contain'>
                <ProtectedNavigation
                  variant='drawer'
                  initialUser={user}
                  onNavigate={close}
                />
              </div>
            </div>
          </DrawerContent>
        </Drawer>
        <div className='flex min-w-0 items-center'>
          <Link
            href='/'
            className='min-w-0 truncate text-lg font-bold'
          >
            <span className={styles.wordmark}>Rebroid</span>
          </Link>
        </div>
      </div>
      <NavigationControls
        user={user}
        placement='header'
        polling={pollNavigation}
      />
    </header>
  )
}
