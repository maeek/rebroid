import type { PublicUser } from '@/shared/contracts/auth-user'

export type ShellUser = Pick<PublicUser, 'avatarDataUrl' | 'name' | 'isPlatformAdmin'> & {
  canCreateApp?: boolean
  canUseExternalDevices?: boolean
  canEnrollExternalDevices?: boolean
  canManageWorkflows?: boolean
  canReviewApks?: boolean
}
