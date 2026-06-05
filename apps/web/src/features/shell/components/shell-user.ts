import type { PublicUser } from '@/server/auth/user'

export type ShellUser = Pick<PublicUser, 'avatarDataUrl' | 'name' | 'role'>
