'use client'

import { useEffect, useState } from 'react'
import { IconLogout, IconSettings, IconUser } from '@tabler/icons-react'
import Link from 'next/link'
import { signOut, useSession } from 'next-auth/react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { Visible } from '@/components/ui/visible'
import { getHslColorFromCharCode, getHslColorFromCharCodeForeground } from '@/utils/hsl-from-text'
import { ProfileDialog } from './profile-dialog'

export const TopBarAccount = () => {
  const session = useSession()
  const [profileOpen, setProfileOpen] = useState(false)
  const [avatar, setAvatar] = useState<string | null>(session.data?.user?.image ?? null)
  const displayName = session.data?.user.name ?? 'User'
  const isAdmin = session.data?.user.role === 'admin'

  useEffect(() => {
    setAvatar(session.data?.user?.image ?? null)
  }, [session.data?.user?.image])

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger>
          <Avatar>
            <AvatarImage src={avatar ?? ''} />
            <AvatarFallback
              style={{
                backgroundColor: getHslColorFromCharCode(displayName),
                color: getHslColorFromCharCodeForeground(displayName)
              }}
            >
              {displayName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align='end'
          style={{ width: '12rem' }}
        >
          <ThemeToggle />
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setProfileOpen(true)}>
            <IconUser className='size-4 mr-2' /> Profile
          </DropdownMenuItem>
          <Visible when={isAdmin}>
            <DropdownMenuItem asChild>
              <Link href='/settings/general'>
                <IconSettings className='size-4 mr-2' /> Settings
              </Link>
            </DropdownMenuItem>
          </Visible>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => void signOut({ redirect: true })}>
            <IconLogout className='size-4 mr-2' /> Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ProfileDialog
        open={profileOpen}
        name={displayName}
        avatar={avatar}
        onOpenChange={setProfileOpen}
        onAvatarSaved={setAvatar}
      />
    </>
  )
}
