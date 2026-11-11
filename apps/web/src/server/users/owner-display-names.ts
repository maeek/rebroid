import { userService } from '@/server/auth/user'

type OwnerLookupUser = {
  isPlatformAdmin: boolean
}

export const getVisibleOwnerDisplayNames = async (user: OwnerLookupUser) =>
  user.isPlatformAdmin
    ? new Map((await userService.listUsers()).map(owner => [owner.id, owner.name || owner.username]))
    : new Map<string, string>()

export const getOwnerDisplayName = (ownerNames: Map<string, string>, ownerUserId?: string | null) =>
  ownerUserId ? (ownerNames.get(ownerUserId) ?? ownerUserId) : null
