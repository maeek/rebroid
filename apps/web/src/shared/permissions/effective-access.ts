import { allPermissionIds, mergeQuotas, unlimitedQuota, type PermissionId, type ResourceQuota } from './permissions'
import type { UserGroup } from '@/shared/contracts/auth-user'

export const administratorsGroupId = 'admins'
export const defaultUserGroupId = 'users'

export const isBuiltInGroup = (id: string) => id === administratorsGroupId || id === defaultUserGroupId

export type EffectivePermissionDecision = { allowed: boolean; groupName: string }

export type EffectiveAccess = {
  groups: UserGroup[]
  isPlatformAdmin: boolean
  decisions: Partial<Record<PermissionId, EffectivePermissionDecision>>
  quotas: ResourceQuota
}

export const resolveEffectiveAccess = (groups: readonly UserGroup[], groupIds: readonly string[]): EffectiveAccess => {
  const groupsById = new Map(groups.map(group => [group.id, group]))
  const selected = groupIds.flatMap(id => {
    const group = groupsById.get(id)
    return group ? [group] : []
  })
  const administrators = selected.find(group => group.id === administratorsGroupId)
  const decisions: EffectiveAccess['decisions'] = {}
  for (const id of allPermissionIds) {
    if (administrators) {
      decisions[id] = { allowed: true, groupName: administrators.name }
      continue
    }
    for (const group of selected) {
      const allowed = group.permissions[id]
      if (allowed !== undefined) decisions[id] = { allowed, groupName: group.name }
    }
  }
  return {
    groups: selected,
    isPlatformAdmin: Boolean(administrators),
    decisions,
    quotas: administrators ? unlimitedQuota : mergeQuotas(...selected.map(group => group.quotas))
  }
}
