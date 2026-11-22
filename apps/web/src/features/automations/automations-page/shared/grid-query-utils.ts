import type { AutomationTriggersGridQuery } from '@/shared/contracts/automation'

export const allFilterValue = 'all'

export function buildAutomationGridHref(
  path: '/automations' | '/automations/triggers',
  {
    gridQuery,
    pageSize,
    patch
  }: { gridQuery: AutomationTriggersGridQuery; pageSize: number; patch: Partial<AutomationTriggersGridQuery> }
) {
  const values = {
    ...gridQuery,
    ...patch,
    page: patch.page ?? gridQuery.page ?? 1,
    pageSize: patch.pageSize ?? gridQuery.pageSize ?? pageSize
  }
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(values)) {
    const text = String(value ?? '').trim()
    if (text && !(key === 'lastRun' && text === allFilterValue)) params.set(key, text)
  }
  return `${path}?${params}`
}
