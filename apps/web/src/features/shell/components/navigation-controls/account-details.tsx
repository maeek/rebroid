import { IconSettings, IconShield } from '@tabler/icons-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import type { ShellUser } from '../shell-user'

export const accountDestinations = [
  { href: '/preferences/general', label: 'Preferences', Icon: IconSettings },
  { href: '/preferences/security', label: 'Security', Icon: IconShield }
] as const

export const AccountAvatar = ({ user }: { user: ShellUser }) => (
  <Avatar
    className='size-7'
    aria-hidden='true'
  >
    <AvatarImage src={user.avatarDataUrl ?? ''} />
    <AvatarFallback className='text-xs text-foreground-muted'>{user.name.slice(0, 2).toUpperCase()}</AvatarFallback>
  </Avatar>
)
