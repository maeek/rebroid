'use client'

import { IconChevronDown, IconLogout, IconSettings, IconShield } from '@tabler/icons-react'
import Link from 'next/link'
import { signOut } from 'next-auth/react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { focusRingClassName } from '@/components/ui/surface'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { cn } from '@/lib/utils'
import type { NavigationPopupPosition } from './popup-position'
import type { ShellUser } from '../shell-user'

export const NavigationAccount = ({
  initialUser,
  popupPosition,
  showName = false
}: {
  initialUser: ShellUser
  popupPosition: NavigationPopupPosition
  showName?: boolean
}) => (
  <DropdownMenu>
    <DropdownMenuTrigger
      aria-label={showName && initialUser.name ? `Account: ${initialUser.name}` : 'Account'}
      className={cn(
        'touch-control inline-flex h-10 shrink-0 items-center rounded-control hover:bg-control-hover',
        showName ? 'w-full min-w-0 gap-2 px-2 text-left text-sm' : 'w-10 justify-center',
        focusRingClassName
      )}
    >
      <Avatar
        className='size-7'
        aria-hidden='true'
      >
        <AvatarImage src={initialUser.avatarDataUrl ?? ''} />
        <AvatarFallback className='text-xs text-foreground-muted'>
          {initialUser.name.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      {showName ? (
        <>
          <span className='min-w-0 flex-1 truncate'>{initialUser.name || 'Account'}</span>
          <IconChevronDown
            aria-hidden='true'
            className='size-3.5 shrink-0 text-foreground-muted'
          />
        </>
      ) : null}
    </DropdownMenuTrigger>
    <DropdownMenuContent
      {...popupPosition}
      className='w-48 max-[359px]:w-42'
    >
      <DropdownMenuItem asChild>
        <Link href='/preferences/general'>
          <IconSettings className='size-4 mr-2' /> Preferences
        </Link>
      </DropdownMenuItem>
      <DropdownMenuItem asChild>
        <Link href='/preferences/security'>
          <IconShield className='size-4 mr-2' /> Security
        </Link>
      </DropdownMenuItem>
      <ThemeToggle side={popupPosition.side === 'bottom' ? 'left' : undefined} />
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={() => void signOut({ redirect: true })}>
        <IconLogout className='size-4 mr-2' /> Log out
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
)
