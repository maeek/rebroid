'use client'
import { IconBrandGithub, IconSunMoon } from '@tabler/icons-react'
import Link from 'next/link'
import { useTheme } from 'next-themes'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ThemeMenuItems } from '@/components/ui/theme-toggle'
import { cn } from '@/lib/utils'

export const TopBarUnprotected = () => {
  const sectionClasses = 'flex items-center h-full px-4 gap-x-8'
  const { setTheme } = useTheme()

  return (
    <div className='flex justify-between h-16 w-dvw shrink-0 fixed top-0 z-10'>
      <div className={cn(sectionClasses, 'justify-start')}>
        <Link href='/'>
          <span className='text-xl font-bold underline underline-offset-4 decoration-primary decoration-solid z-99 text-foreground'>
            Rebroid
          </span>
        </Link>
      </div>
      <div className={cn(sectionClasses, 'justify-end flex-initial w-full max-w-(--breakpoint-sm)')}>
        <a
          href='https://github.com/maeek/rebroid'
          target='_blank'
          rel='noopener noreferrer'
          aria-label='Open Rebroid on GitHub'
          className='text-foreground transition-colors duration-200 flex items-center gap-x-1 hover:text-primary'
        >
          <IconBrandGithub className='size-6' />
        </a>
        <DropdownMenu>
          <DropdownMenuTrigger aria-label='Choose theme'>
            <IconSunMoon className='size-6' />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <ThemeMenuItems onSelect={setTheme} />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
