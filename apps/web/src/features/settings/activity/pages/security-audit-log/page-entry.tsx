import { ActivityEventsTable } from '../../activity-events-table'
import { ActivityPageLayout } from '../../activity-page-layout'
import { loadSecurityAuditLogPageData } from './page-data.server'
import type { AuditSearchParams } from '@/shared/contracts/audit'

export async function SecurityAuditLogPageEntry({ searchParams }: { searchParams?: Promise<AuditSearchParams> }) {
  const { auditRetentionDays, facets, filters, result, sorting } = await loadSecurityAuditLogPageData(
    (await searchParams) ?? {}
  )

  return (
    <ActivityPageLayout>
      <ActivityEventsTable
        result={result}
        filters={filters}
        sorting={sorting}
        facets={facets}
        auditRetentionDays={auditRetentionDays}
      />
    </ActivityPageLayout>
  )
}
