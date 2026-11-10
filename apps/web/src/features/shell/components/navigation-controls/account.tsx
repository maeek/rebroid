'use client'

import { useRef, useState } from 'react'
import { IconLogout, IconSettings, IconUser } from '@tabler/icons-react'
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
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { getHslColorFromCharCode, getHslColorFromCharCodeForeground } from '@/utils/hsl-from-text'
import { ProfileDialog } from './profile-dialog'
import type { NavigationPopupPosition } from './popup-position'
import type { ShellUser } from '../shell-user'

export const NavigationAccount = ({
  initialUser,
  popupPosition
}: {
  initialUser: ShellUser
  popupPosition: NavigationPopupPosition
}) => {
  const [profileOpen, setProfileOpen] = useState(false)
  const accountTrigger = useRef<HTMLButtonElement>(null)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          ref={accountTrigger}
          aria-label='Account'
          className='touch-control inline-flex shrink-0 items-center justify-center rounded-full'
        >
          <Avatar>
            <AvatarImage src={initialUser.avatarDataUrl ?? ''} />
            <AvatarFallback
              style={{
                backgroundColor: getHslColorFromCharCode(initialUser.name),
                color: getHslColorFromCharCodeForeground(initialUser.name)
              }}
            >
              {initialUser.name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          {...popupPosition}
          className='w-48 max-[359px]:w-42'
        >
          <ThemeToggle side={popupPosition.side === 'bottom' ? 'left' : undefined} />
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setProfileOpen(true)}>
            <IconUser className='size-4 mr-2' /> Account overview
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href='/preferences/general'>
              <IconSettings className='size-4 mr-2' /> Preferences
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => void signOut({ redirect: true })}>
            <IconLogout className='size-4 mr-2' /> Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ProfileDialog
        open={profileOpen}
        user={initialUser}
        onOpenChange={setProfileOpen}
        finalFocus={accountTrigger}
      />
    </>
  )
}
