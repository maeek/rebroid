'use client'

import { useState } from 'react'
import { IconMenu2, IconStackBack, IconX } from '@tabler/icons-react'
import classNames from 'classnames'
import Link from 'next/link'
import { ProtectedNavigation } from '../protected-navigation'
import { TopBarAccount } from './account'
import { OrchestratorStatus } from './orchestrator-status'
import { Drawer, DrawerContent, DrawerTrigger } from '@/components/ui/drawer'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Visible } from '@/components/ui/visible'
import { yourApps } from '@/features/applications/domain/app-definition'

export const TopBarProtected = () => {
  const sectionClasses = 'flex min-w-0 items-center h-full px-4 gap-x-4 max-sm:px-2 lg:w-[33%]'
  const runningApps = yourApps.filter(app => app.running)

  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <div className='sticky top-0 z-50 flex h-16 w-full max-w-full shrink-0 justify-between overflow-hidden bg-transparent max-sm:px-1'>
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
              className='inline-flex size-10 shrink-0 items-center justify-center rounded-md text-secondary-foreground transition hover:bg-secondary/70 hover:text-foreground active:scale-95 lg:hidden'
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
            <div className='max-h-[80dvh] overflow-y-auto'>
              <ProtectedNavigation
                variant='drawer'
                onNavigate={() => setDrawerOpen(false)}
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
        <Visible when={runningApps.length > 0}>
          <Popover>
            <PopoverTrigger className='mr-2'>
              <IconStackBack className='text-secondary-foreground hover:text-foreground focus:text-foreground' />
            </PopoverTrigger>

            <PopoverContent className='w-80'>
              <div className='flex flex-col'>
                <h3 className='text-lg font-semibold pb-4'>Running Apps</h3>
                {runningApps.map(app => (
                  <Link
                    href={`/app/${app.id}`}
                    key={`popover-app-${app.id}`}
                  >
                    <div className='flex text-sm px-4 py-2 rounded-sm hover:bg-popover'>{app.name}</div>
                  </Link>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </Visible>
        <TopBarAccount />
      </div>
    </div>
  )
}
