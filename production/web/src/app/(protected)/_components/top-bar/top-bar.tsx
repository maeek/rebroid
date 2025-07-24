'use client'

import { useState } from 'react'
import { IconLayoutDashboard, IconMenu2, IconStackBack, IconX } from '@tabler/icons-react'
import classNames from 'classnames'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Drawer, DrawerContent, DrawerTrigger } from '@/components/ui/drawer'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { appsSections, settingsSections, yourApps } from '../../(standard)/constants'
import { TopBarAccount } from './account'

export const TopBarProtected = () => {
  const sectionClasses = 'flex items-center h-full px-4 gap-x-4 max-sm:px-2 sm:w-[33%]'
  const runningApps = yourApps.filter(app => app.running)

  const pathname = usePathname()
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
              <div className='flex flex-col p-4'>
                <Link href={'/'}>
                  <li
                    className={classNames(
                      'flex gap-2 justify-start items-center px-2 py-1 max-lg:py-2 hover:bg-input rounded-sm text-foreground dark:hover:text-white cursor-pointer mb-4',
                      { 'bg-input': pathname === '/dashboard' }
                    )}
                  >
                    <div className='size-8 rounded-sm flex justify-center items-center'>
                      <IconLayoutDashboard className='size-5 max-lg:size-5 stroke-current' />
                    </div>
                    <span className='text-base max-lg:text-inherit text-inherit'>Dashboard</span>
                  </li>
                </Link>
                <h6 className='text-sm pb-4 font-semibold color-secondary px-2 max-lg:text-sm'>Apps</h6>
                <ul className='w-full pb-6 flex flex-col'>
                  {appsSections.map(({ name, Icon, href }) => (
                    <Link
                      key={name}
                      href={href || '/'}
                      onClick={() => setDrawerOpen(false)}
                    >
                      <li
                        className={classNames(
                          'flex gap-2 justify-start items-center px-2 py-1 max-lg:py-2 hover:bg-input rounded-sm text-foreground dark:hover:text-white cursor-pointer',
                          { 'bg-input': pathname === href }
                        )}
                      >
                        <div className='size-8 rounded-sm flex justify-center items-center'>
                          <Icon className='size-5 max-lg:size-5 stroke-current' />
                        </div>
                        <span className='text-base max-lg:text-inherit text-inherit'>{name}</span>
                      </li>
                    </Link>
                  ))}
                </ul>
                <h6 className='text-sm pb-4 font-semibold color-secondary px-2 max-lg:text-sm'>Settings</h6>
                <ul className='w-full pb-6 flex flex-col'>
                  {settingsSections.map(({ name, Icon, href }) => (
                    <Link
                      key={name}
                      href={href || '/'}
                      onClick={() => setDrawerOpen(false)}
                    >
                      <li
                        className={classNames(
                          'flex gap-2 justify-start items-center px-2 py-1 max-lg:py-2 hover:bg-input rounded-sm text-foreground dark:hover:text-white cursor-pointer',
                          { 'bg-input': pathname === href }
                        )}
                      >
                        <div className='size-8 rounded-sm flex justify-center items-center'>
                          <Icon className='size-5 max-lg:size-5 stroke-current' />
                        </div>
                        <span className='text-base max-lg:text-inherit text-inherit'>{name}</span>
                      </li>
                    </Link>
                  ))}
                </ul>
              </div>
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
        <TopBarAccount />
      </div>
    </div>
  )
}
