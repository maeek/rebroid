import { PlatformPageHeader } from '@/shared/ui/page/platform-page-header'
import { ProtectedStackPageLayout } from '@/shared/ui/page/protected-page-shell'
import { ActivityEventsTable } from '../../activity-events-table'
import { loadOperationsActivityPageData, type AuditSearchParams } from './page-data.server'

export async function OperationsActivityPageEntry({ searchParams }: { searchParams?: Promise<AuditSearchParams> }) {
  const { auditRetentionDays, facets, filters, result, sorting } = await loadOperationsActivityPageData(
    (await searchParams) ?? {}
  )

  return (
    <ProtectedStackPageLayout mainClassName='gap-2'>
      <PlatformPageHeader
        title='Activity'
        description='Review recent administrative and application operations.'
        breadcrumbRoot={{ label: 'Operations' }}
      />
      <section className='flex w-full flex-col gap-6 px-6 pb-16 max-sm:px-4'>
        <ActivityEventsTable
          result={result}
          filters={filters}
          sorting={sorting}
          facets={facets}
          auditRetentionDays={auditRetentionDays}
        />
      </section>
    </ProtectedStackPageLayout>
  )
}
