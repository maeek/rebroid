import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent, StandardPage } from '@/shared/ui/page/page-layout'
import { ActivityEventsTable } from '../../activity-events-table'
import { loadSecurityAuditLogPageData, type AuditSearchParams } from './page-data.server'

export async function SecurityAuditLogPageEntry({ searchParams }: { searchParams?: Promise<AuditSearchParams> }) {
  const { auditRetentionDays, facets, filters, result, sorting } = await loadSecurityAuditLogPageData(
    (await searchParams) ?? {}
  )

  return (
    <StandardPage className='gap-2'>
      <PageHeader
        section={{ label: 'Security' }}
        title='Audit log'
        description='Review recent administrative and application operations.'
      />
      <PageContent>
        <ActivityEventsTable
          result={result}
          filters={filters}
          sorting={sorting}
          facets={facets}
          auditRetentionDays={auditRetentionDays}
        />
      </PageContent>
    </StandardPage>
  )
}
