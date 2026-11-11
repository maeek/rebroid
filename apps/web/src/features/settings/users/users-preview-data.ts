import { defaultUserQuota } from '@/shared/permissions/permissions'
import type { PublicUser } from '@/shared/contracts/auth-user'

export const previewUsers: PublicUser[] = [
  { id: 'operator', username: 'ada', name: 'Ada Lovelace', disabled: false },
  { id: 'reviewer', username: 'grace', name: 'Grace Hopper', disabled: true }
].map(user => ({
  ...user,
  isPlatformAdmin: false,
  groupIds: [],
  passwordChangeRequired: false,
  mfaEnabled: false,
  sessionVersion: 1,
  avatarDataUrl: null,
  accentColor: 'blue',
  effectivePermissions: {},
  effectiveQuotas: defaultUserQuota,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z'
}))
