'use client'

import { CSSProperties } from 'react'
import { IconLogout, IconSettingsCog, IconUser } from '@tabler/icons-react'
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

export const TopBarAccount = () => {
  const session = useSession()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Avatar>
          <AvatarImage src={session.data?.user?.image ?? ''} />
          <AvatarFallback>{session.data?.user.name?.slice(0, 2).toLocaleUpperCase()}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align='end'
        style={{ width: '12rem' } as CSSProperties}
      >
        <ThemeToggle />
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <IconUser className='size-4 mr-2' /> Profile
        </DropdownMenuItem>
        <DropdownMenuItem>
          <IconSettingsCog className='size-4 mr-2' /> Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void signOut({ redirect: true })}>
          <IconLogout className='size-4 mr-2' /> Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
