import type { ApkBlockScope, ApkLibraryAction, ApkLibraryEntry } from '@/shared/contracts/apk-library'

export const statusFilters = { all: 'Any status', ready: 'Ready', blocked: 'Blocked' } as const
export const usageFilters = { all: 'Any usage', unused: 'Unused', used: 'In use' } as const
type StatusFilter = keyof typeof statusFilters
type UsageFilter = keyof typeof usageFilters

export const scopeLabels = {
  sha256: 'Exact file (SHA-256)',
  package: 'Android package name'
} as const

export const blockRuleValue = (entry: ApkLibraryEntry, scope: ApkBlockScope) =>
  scope === 'sha256' ? entry.sha256 : entry.packageName

export const entryLabel = (entry: ApkLibraryEntry) => {
  if (!entry.sha256 && entry.packageName) return entry.packageName
  return entry.displayName ?? entry.originalName
}

export const filterLibraryEntries = (
  entries: ApkLibraryEntry[],
  query: string,
  status: StatusFilter,
  usage: UsageFilter
) => {
  const search = query.trim().toLowerCase()
  return entries.filter(entry => {
    if (status !== 'all' && (entry.rules.length ? 'blocked' : 'ready') !== status) return false
    if (usage !== 'all' && (entry.sizeBytes === null || (entry.apps.length ? 'used' : 'unused') !== usage)) return false
    return (
      !search ||
      [entry.displayName, entry.originalName, entry.packageName, entry.sha256].some(value =>
        value?.toLowerCase().includes(search)
      )
    )
  })
}

export const getActionExclusion = (entry: ApkLibraryEntry, action: ApkLibraryAction, scope: ApkBlockScope) => {
  if (action === 'delete') {
    if (entry.sizeBytes === null) return 'File already removed'
    if (entry.apps.length) return `Used by ${entry.apps.map(app => app.name).join(', ')}`
    return null
  }
  if (action === 'block' && entry.sizeBytes === null) return 'File already removed'
  if (!blockRuleValue(entry, scope)) return 'This APK has no value for this scope'
  const hasRule = entry.rules.some(rule => rule.scope === scope)
  if (action === 'block' && hasRule) return 'Already blocked at this scope'
  if (action === 'unblock' && !hasRule) return 'There is no block at this scope'
  return null
}

export const availableBlockScopes = (entries: ApkLibraryEntry[], action: 'block' | 'unblock'): ApkBlockScope[] =>
  (['sha256', 'package'] as const).filter(scope => entries.some(entry => !getActionExclusion(entry, action, scope)))

export const readLibraryFilter = <T extends string>(
  value: string | null,
  allowed: Record<T, string>,
  fallback: T
): T => (value && Object.hasOwn(allowed, value) ? (value as T) : fallback)
