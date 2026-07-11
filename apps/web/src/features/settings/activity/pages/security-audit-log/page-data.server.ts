import {
  auditFiltersFromSearchParams,
  auditPageFromSearchParams,
  auditSortFromSearchParams,
  type AuditSearchParams
} from '@/server/audit/query'
import { requireAdmin } from '@/server/auth/authorization'
import { listAuditEvents, listAuditFacetValues } from '@/server/persistence/audit-repository'
import { getWebSettings } from '@/server/web-settings/store'

const firstValue = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)

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
      search: firstValue(searchParams.search),
      actor: firstValue(searchParams.actor),
      category: firstValue(searchParams.category),
      action: firstValue(searchParams.action),
      resourceType: firstValue(searchParams.resourceType),
      outcome: firstValue(searchParams.outcome),
      from: firstValue(searchParams.from),
      to: firstValue(searchParams.to)
    },
    result: listAuditEvents(filters, { ...page, sorting }),
    sorting
  }
}

export type { AuditSearchParams }
