import type { UserGroup, UserRole } from '@/shared/contracts/auth-user'
import type { PermissionId, PermissionMap } from '@/shared/permissions/permissions'

export type PermissionInheritanceMap = Partial<Record<PermissionId, { allowed: boolean; source: string }>>

/** Mirror persisted group order and the server's fallback without changing access policy. */
export const resolveUserGroups = (groups: UserGroup[], groupIds: string[], role: UserRole): UserGroup[] => {
  const selected = groupIds.flatMap(id => {
    const group = groups.find(candidate => candidate.id === id)
    return group ? [group] : []
  })
  if (selected.length > 0) return selected
  const fallback = groups.find(group => group.role === role) ?? groups.find(group => group.id === 'users') ?? groups[0]
  return fallback ? [fallback] : []
}

export const setPermissionDecision = (permissions: PermissionMap, id: PermissionId, value: string): PermissionMap => {
  const next = { ...permissions }
  if (value === 'inherit' || value === 'unset') delete next[id]
  else next[id] = value === 'allow'
  return next
}
