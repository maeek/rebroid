'use client'

import classNames from 'classnames'
import Link from 'next/link'
import { TopBarAccount } from './account'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { IconStackBack } from '@tabler/icons-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

export const TopBarProtected = () => {
  const sectionClasses = 'flex items-center h-full px-4 gap-x-4 max-sm:px-2 sm:w-[33%]'
  const yourApps = [
    { id: 'uxjswa', name: 'Zappka', icon: 'zappka.png', running: true },
    { id: 'vihwqd', name: "McDonald's", icon: 'mcdonalds.png', running: true },
    { id: 'cmisdf', name: 'Orlen Vitay', icon: 'orlen.png', running: true }
  ]

  return (
    <div className='z-50 flex justify-between h-16 w-dvw flex-shrink-0 sticky top-0 max-w-full max-sm:px-1'>
      <div className={classNames(sectionClasses, 'justify-start')}>
        <Link href='/'>
          <span className='text-xl font-bold'>Shop</span>
          <span className='text-xl font-bold'>Me</span>
          <span className='text-xl font-bold underline underline-offset-4 decoration-primary decoration-solid'>
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
              {yourApps.map(app => (
                <Link
                  href={`/apps/${app.id}`}
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
