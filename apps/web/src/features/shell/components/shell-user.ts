import type { PublicUser } from '@/shared/contracts/auth-user'

export type ShellUser = Pick<PublicUser, 'accentColor' | 'avatarDataUrl' | 'mfaEnabled' | 'name' | 'role'>
