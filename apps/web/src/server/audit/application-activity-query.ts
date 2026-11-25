import 'server-only'
import { requireAdmin } from '@/server/auth/authorization'
import { listAuditEvents } from '@/server/persistence/audit-repository'
import { getWebSettings } from '@/server/web-settings/store'
import { paginationFromSearchParams } from '@/shared/model/search-params'
import { auditFiltersFromSearchParams, auditFilterValuesFromFilters, auditSortFromSearchParams } from './query'
import type { AuditSearchParams } from '@/shared/contracts/audit'

export const loadApplicationActivity = async (applicationId: string, searchParams: AuditSearchParams) => {
  await requireAdmin()
  const settings = await getWebSettings()
  const filters = {
    ...auditFiltersFromSearchParams(searchParams),
    resourceType: 'device',
    resourceId: applicationId
  }
  const sorting = auditSortFromSearchParams(searchParams)
  return {
    auditRetentionDays: settings.auditRetentionDays,
    facets: { actors: [], categories: [], actions: [], resourceTypes: [] },
    filters: auditFilterValuesFromFilters(filters),
    result: listAuditEvents(filters, { ...paginationFromSearchParams(searchParams), sorting }),
    sorting
  }
}
