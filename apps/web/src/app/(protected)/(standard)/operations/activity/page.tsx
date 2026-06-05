import { PlatformPageHeader } from '@/features/orchestrator/components/platform-page-header'
import { ActivityEventsTable } from '@/features/settings/activity/activity-events-table'
import { ProtectedStackPageLayout } from '@/features/shell/components/protected-page-shell'
import {
  auditFiltersFromSearchParams,
  auditPageFromSearchParams,
  auditSortFromSearchParams,
  type AuditSearchParams
} from '@/server/audit/query'
import { requireAdmin } from '@/server/auth/authorization'
import { listAuditEvents, listAuditFacetValues } from '@/server/storage/database'
import { getWebSettings } from '@/server/web-settings/store'

const firstValue = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)

export default async function ActivitySettingsPage({ searchParams }: { searchParams?: Promise<AuditSearchParams> }) {
  await requireAdmin()
  const resolvedSearchParams = (await searchParams) ?? {}
  const settings = await getWebSettings()
  const filters = auditFiltersFromSearchParams(resolvedSearchParams)
  const page = auditPageFromSearchParams(resolvedSearchParams)
  const sorting = auditSortFromSearchParams(resolvedSearchParams)
  const result = listAuditEvents(filters, { ...page, sorting })
  const facets = listAuditFacetValues()

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
          filters={{
            search: firstValue(resolvedSearchParams.search),
            actor: firstValue(resolvedSearchParams.actor),
            category: firstValue(resolvedSearchParams.category),
            action: firstValue(resolvedSearchParams.action),
            resourceType: firstValue(resolvedSearchParams.resourceType),
            outcome: firstValue(resolvedSearchParams.outcome),
            from: firstValue(resolvedSearchParams.from),
            to: firstValue(resolvedSearchParams.to)
          }}
          sorting={sorting}
          facets={facets}
          auditRetentionDays={settings.auditRetentionDays}
        />
      </section>
    </ProtectedStackPageLayout>
  )
}
