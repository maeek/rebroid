import {
  auditFiltersFromSearchParams,
  auditFilterValuesFromFilters,
  auditPageFromSearchParams,
  auditSortFromSearchParams
} from '@/server/audit/query'
import { requireAdmin } from '@/server/auth/authorization'
import { listAuditEvents, listAuditFacetValues } from '@/server/persistence/audit-repository'
import { getWebSettings } from '@/server/web-settings/store'
import type { AuditSearchParams } from '@/shared/contracts/audit'

export const loadSecurityAuditLogPageData = async (searchParams: AuditSearchParams) => {
  await requireAdmin()

  const settings = await getWebSettings()
  const filters = auditFiltersFromSearchParams(searchParams)
  const page = auditPageFromSearchParams(searchParams)
  const sorting = auditSortFromSearchParams(searchParams)

  return {
    auditRetentionDays: settings.auditRetentionDays,
    facets: listAuditFacetValues(),
    filters: auditFilterValuesFromFilters(filters),
    result: listAuditEvents(filters, { ...page, sorting }),
    sorting
  }
}
