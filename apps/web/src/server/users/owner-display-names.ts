import { userService } from '@/server/auth/user'
import { readUserDisplayNames } from '@/server/persistence/users-repository'

type OwnerLookupUser = {
  isPlatformAdmin: boolean
}

export const getVisibleOwnerDisplayNames = async (user: OwnerLookupUser, ownerIds?: readonly string[]) => {
  if (!user.isPlatformAdmin) return new Map<string, string>()
  if (ownerIds) return readUserDisplayNames(ownerIds)
  return new Map((await userService.listUsers()).map(owner => [owner.id, owner.name || owner.username]))
}

export const getOwnerDisplayName = (ownerNames: Map<string, string>, ownerUserId?: string | null) =>
  ownerUserId ? (ownerNames.get(ownerUserId) ?? ownerUserId) : null
