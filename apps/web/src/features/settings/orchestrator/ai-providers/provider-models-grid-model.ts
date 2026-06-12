import type { ProviderModelRow } from '@rebroid/ai-core/provider'

export type ProviderModelRole = 'planner' | 'vision'

export const selectedProviderModelIndexes = (rows: ProviderModelRow[], selectedIds: Set<string>) =>
  rows.filter(model => selectedIds.has(model.rowId)).map(model => model.index)

export const findProviderModelSettingsRow = (rows: ProviderModelRow[], rowId: string | null) =>
  rows.find(model => model.rowId === rowId) ?? null

export const nextProviderModelRoles = (
  roles: ProviderModelRow['roles'] | undefined,
  role: ProviderModelRole,
  enabled: boolean
) => {
  const nextRoles = new Set(roles ?? [])
  if (enabled) nextRoles.add(role)
  else nextRoles.delete(role)
  return Array.from(nextRoles)
}
