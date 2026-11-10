import type { PermissionId, PermissionMap } from '@/shared/permissions/permissions'

export const setPermissionDecision = (permissions: PermissionMap, id: PermissionId, value: string): PermissionMap => {
  const next = { ...permissions }
  if (value === 'inherit' || value === 'unset') delete next[id]
  else next[id] = value === 'allow'
  return next
}
