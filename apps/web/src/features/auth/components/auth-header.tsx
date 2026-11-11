'use client'

import { IconBrandGithub, IconSunMoon } from '@tabler/icons-react'
import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { focusRingClassName } from '@/components/ui/surface'
import { ThemeMenuItems } from '@/components/ui/theme-toggle'
import { cn } from '@/lib/utils'
import { RebroidIcon } from '@/shared/ui/branding/rebroid-icon'
import styles from '@/shared/ui/branding/rebroid-wordmark.module.css'

export const AuthHeader = ({ originalLogo }: { originalLogo?: boolean }) => (
  <header className='m-2 flex min-h-12 items-center justify-between gap-2 rounded-panel bg-surface-navigation px-2 py-1 sm:px-3'>
    <Link
      href='/login'
      className={cn('touch-control inline-flex h-9 items-center gap-2 rounded-control px-1.5', focusRingClassName)}
    >
      {originalLogo ? (
        <Image
          src='/rebroid-icon.svg'
          alt=''
          width={24}
          height={24}
          className='size-6 shrink-0'
          unoptimized
        />
      ) : (
        <RebroidIcon />
      )}
      <span className={cn(styles.wordmark, 'text-lg font-bold')}>Rebroid</span>
    </Link>
    <div className='flex items-center gap-1'>
      <Button
        asChild
        variant='ghost'
        size='icon-md'
      >
        <a
          href='https://github.com/maeek/rebroid'
          target='_blank'
          rel='noopener noreferrer'
          aria-label='Open Rebroid on GitHub'
        >
          <IconBrandGithub className='size-5' />
        </a>
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type='button'
            variant='ghost'
            size='icon-md'
            aria-label='Choose theme'
          >
            <IconSunMoon className='size-5' />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end'>
          <ThemeMenuItems />
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  </header>
)
