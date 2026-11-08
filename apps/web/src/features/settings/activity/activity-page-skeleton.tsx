'use client'

import { ActivityEventsTable } from './activity-events-table'
import { ActivityPageLayout } from './activity-page-layout'

export const ActivityPageSkeleton = () => (
  <ActivityPageLayout>
    <ActivityEventsTable
      result={{ events: [], total: 0, page: 1, pageSize: 20, summary: { success: 0, failure: 0, lastEventAt: null } }}
      filters={{}}
      sorting={[{ id: 'createdAt', desc: true }]}
      facets={{ actors: [], categories: [], actions: [], resourceTypes: [] }}
      auditRetentionDays={30}
      loading
    />
  </ActivityPageLayout>
)

export const AppActivityLoading = () => (
  <ActivityEventsTable
    application={{ id: '', name: 'Application' }}
    result={{ events: [], total: 0, page: 1, pageSize: 20, summary: { success: 0, failure: 0, lastEventAt: null } }}
    filters={{}}
    sorting={[{ id: 'createdAt', desc: true }]}
    facets={{ actors: [], categories: [], actions: [], resourceTypes: [] }}
    auditRetentionDays={30}
    loading
  />
)
