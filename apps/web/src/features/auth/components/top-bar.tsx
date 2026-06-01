'use client'
import { GitHubLogoIcon } from '@radix-ui/react-icons'
import { IconMoon, IconSun, IconSunMoon } from '@tabler/icons-react'
import classNames from 'classnames'
import Link from 'next/link'
import { useTheme } from 'next-themes'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

export const TopBarUnprotected = () => {
  const sectionClasses = 'flex items-center h-full px-4 gap-x-8'
  const { setTheme } = useTheme()

  return (
    <div className='flex justify-between h-16 w-dvw shrink-0 sticky top-0 z-10'>
      <div className={classNames(sectionClasses, 'justify-start')}>
        <Link href='/'>
          <span className='text-xl font-black underline underline-offset-4 decoration-primary decoration-solid z-99 text-foreground'>
            Rebroid
          </span>
        </Link>
      </div>
      <div className={classNames(sectionClasses, 'justify-end flex-initial w-full max-w-(--breakpoint-sm)')}>
        <a
          href='https://github.com/maeek/rebroid'
          target='_blank'
          rel='noopener noreferrer'
          className='text-foreground transition-colors duration-200 flex items-center gap-x-1 hover:text-primary'
        >
          <GitHubLogoIcon className='w-6 h-6' />
        </a>
        <DropdownMenu>
          <DropdownMenuTrigger>
            <IconSunMoon className='size-6' />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => setTheme('light')}>
              <IconSun className='h-4 mr-2' /> Light
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme('dark')}>
              <IconMoon className='h-4 mr-2' /> Dark
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme('system')}>
              <IconSunMoon className='h-4 mr-2' /> System
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
