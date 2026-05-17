'use client'

import { useState } from 'react'
import { IconMenu2, IconStackBack, IconX } from '@tabler/icons-react'
import classNames from 'classnames'
import Link from 'next/link'
import { Drawer, DrawerContent, DrawerTrigger } from '@/components/ui/drawer'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Visible } from '@/components/ui/visible'
import { yourApps } from '../../(standard)/constants'
import { ProtectedNavigation } from '../protected-navigation'
import { TopBarAccount } from './account'
import { OrchestratorStatus } from './orchestrator-status'

export const TopBarProtected = () => {
  const sectionClasses = 'flex items-center h-full px-4 gap-x-4 max-sm:px-2 sm:w-[33%]'
  const runningApps = yourApps.filter(app => app.running)

  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <div className='flex justify-between h-16 w-dvw shrink-0 sticky top-0 max-w-full max-sm:px-1 backdrop-blur-2xl z-50'>
      <div className={classNames(sectionClasses, 'justify-start items-center')}>
        <div className='cursor-pointer sm:hidden active:scale-95'>
          <Drawer
            open={drawerOpen}
            onOpenChange={setDrawerOpen}
          >
            <DrawerTrigger asChild>{drawerOpen ? <IconX /> : <IconMenu2 />}</DrawerTrigger>
            <DrawerContent>
              <ProtectedNavigation
                variant='drawer'
                onNavigate={() => setDrawerOpen(false)}
              />
            </DrawerContent>
          </Drawer>
        </div>
        <Link href='/'>
          <span className='text-xl max-sm:text-md font-black'>Shop</span>
          <span className='text-xl max-sm:text-md font-black'>Me</span>
          <span className='text-xl max-sm:text-md font-black underline underline-offset-4 decoration-primary decoration-solid'>
            Alone
          </span>
        </Link>
      </div>
      <div className={classNames(sectionClasses, 'justify-end')}>
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
