import { userService } from '@/server/auth/user'

type OwnerLookupUser = {
  role: string
}

export const getVisibleOwnerDisplayNames = async (user: OwnerLookupUser) =>
  user.role === 'admin'
    ? new Map((await userService.listUsers()).map(owner => [owner.id, owner.name || owner.username]))
    : new Map<string, string>()

export const getOwnerDisplayName = (ownerNames: Map<string, string>, ownerUserId?: string | null) =>
  ownerUserId ? (ownerNames.get(ownerUserId) ?? ownerUserId) : null
