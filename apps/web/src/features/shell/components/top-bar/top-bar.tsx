'use client'

import { useState } from 'react'
import { IconMenu2, IconX } from '@tabler/icons-react'
import classNames from 'classnames'
import Link from 'next/link'
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer'
import { Visible } from '@/components/ui/visible'
import { ProtectedNavigation } from '../protected-navigation'
import { TopBarAccount } from './account'
import { TopBarNotifications } from './notifications'
import { OrchestratorStatus } from './orchestrator-status'
import type { ShellUser } from '../shell-user'

export const TopBarProtected = ({ initialUser }: { initialUser: ShellUser }) => {
  const sectionClasses = 'flex min-w-0 items-center h-full px-4 gap-x-4 max-sm:px-2 lg:w-[33%]'

  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <div className='fixed top-0 z-50 flex h-16 w-full max-w-full shrink-0 justify-between overflow-hidden bg-transparent max-sm:px-1'>
      <div
        aria-hidden='true'
        className='pointer-events-none absolute inset-x-0 bottom-0 backdrop-blur-xl h-full'
      />
      <div className={classNames(sectionClasses, 'relative z-10 justify-start items-center')}>
        <Drawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
        >
          <DrawerTrigger asChild>
            <button
              type='button'
              aria-label={drawerOpen ? 'Close navigation' : 'Open navigation'}
              className='inline-flex size-10 shrink-0 items-center justify-center rounded-md text-foreground-muted transition hover:bg-secondary/70 hover:text-foreground active:scale-95 lg:hidden'
            >
              <Visible when={drawerOpen}>
                <IconX className='size-5' />
              </Visible>
              <Visible when={!drawerOpen}>
                <IconMenu2 className='size-5' />
              </Visible>
            </button>
          </DrawerTrigger>
          <DrawerContent className='max-h-[85dvh] overflow-hidden rounded-t-xl border-border/80 bg-background/95'>
            <DrawerTitle className='sr-only'>Navigation</DrawerTitle>
            <DrawerDescription className='sr-only'>Navigate between apps and settings pages.</DrawerDescription>
            <div className='scrollbar-thin max-h-[80dvh] overflow-x-hidden overflow-y-auto'>
              <ProtectedNavigation
                variant='drawer'
                initialUser={initialUser}
                onNavigate={() => window.setTimeout(() => setDrawerOpen(false), 0)}
              />
            </div>
          </DrawerContent>
        </Drawer>
        <Link
          href='/'
          className='min-w-0'
        >
          <span className='block truncate text-xl font-black underline underline-offset-4 decoration-primary decoration-solid'>
            Rebroid
          </span>
        </Link>
      </div>
      <div className={classNames(sectionClasses, 'relative z-10 justify-end')}>
        <OrchestratorStatus />
        <TopBarNotifications />
        <TopBarAccount initialUser={initialUser} />
      </div>
    </div>
  )
}
