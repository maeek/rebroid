import { allPermissionIds, type PermissionId, type PermissionMap } from './permissions'
import type { UserGroup, UserRole } from '@/shared/contracts/auth-user'

export type EffectivePermissionDecision = { allowed: boolean } & (
  | { source: 'group'; groupName: string }
  | { source: 'override'; groupName?: string }
  | { source: 'admin'; groupName?: never }
)

export type EffectiveAccess = {
  groups: UserGroup[]
  decisions: Partial<Record<PermissionId, EffectivePermissionDecision>>
}

export const resolveUserGroups = (
  groups: readonly UserGroup[],
  groupIds: readonly string[] | undefined,
  role: UserRole
): UserGroup[] => {
  const selected = (groupIds ?? []).flatMap(id => {
    const group = groups.find(candidate => candidate.id === id)
    return group ? [group] : []
  })
  if (selected.length > 0) return selected
  const fallback = groups.find(group => group.role === role)
  return fallback ? [fallback] : []
}

export const resolveEffectiveAccess = (
  groups: readonly UserGroup[],
  groupIds: readonly string[] | undefined,
  role: UserRole,
  overrides: PermissionMap
): EffectiveAccess => {
  const resolvedGroups = resolveUserGroups(groups, groupIds, role)
  const decisions: EffectiveAccess['decisions'] = {}
  for (const id of allPermissionIds) {
    if (role === 'admin') {
      decisions[id] = { allowed: true, source: 'admin' }
      continue
    }

    for (const group of resolvedGroups) {
      const allowed = group.permissions[id]
      if (allowed !== undefined) decisions[id] = { allowed, source: 'group', groupName: group.name }
    }
    const override = overrides[id]
    if (override !== undefined) {
      decisions[id] = { allowed: override, source: 'override', groupName: decisions[id]?.groupName }
    }
  }
  return { groups: resolvedGroups, decisions }
}
