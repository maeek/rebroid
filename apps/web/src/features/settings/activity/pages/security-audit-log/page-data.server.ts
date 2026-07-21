import {
  auditFiltersFromSearchParams,
  auditPageFromSearchParams,
  auditSortFromSearchParams
} from '@/server/audit/query'
import { requireAdmin } from '@/server/auth/authorization'
import { listAuditEvents, listAuditFacetValues } from '@/server/persistence/audit-repository'
import { getWebSettings } from '@/server/web-settings/store'
import { firstSearchParamValue } from '@/shared/model/search-params'
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
    filters: {
      search: firstSearchParamValue(searchParams.search),
      actor: firstSearchParamValue(searchParams.actor),
      category: firstSearchParamValue(searchParams.category),
      action: firstSearchParamValue(searchParams.action),
      resourceType: firstSearchParamValue(searchParams.resourceType),
      outcome: firstSearchParamValue(searchParams.outcome),
      from: firstSearchParamValue(searchParams.from),
      to: firstSearchParamValue(searchParams.to)
    },
    result: listAuditEvents(filters, { ...page, sorting }),
    sorting
  }
}
