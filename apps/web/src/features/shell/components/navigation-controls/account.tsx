'use client'

import { IconChevronDown, IconLogout } from '@tabler/icons-react'
import Link from 'next/link'
import { signOut } from 'next-auth/react'
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
import { AccountAvatar, accountDestinations } from './account-details'
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
      <AccountAvatar user={initialUser} />
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
      className='w-48 max-[359px]:w-40 max-[359px]:min-w-40'
    >
      {accountDestinations.map(({ href, label, Icon }) => (
        <DropdownMenuItem
          asChild
          key={href}
        >
          <Link href={href}>
            <Icon className='size-3.5' /> {label}
          </Link>
        </DropdownMenuItem>
      ))}
      <ThemeToggle />
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={() => void signOut({ redirect: true })}>
        <IconLogout className='size-3.5' /> Log out
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
)
