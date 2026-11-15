'use client'

import { Section } from '@/components/ui/section'
import { cn } from '@/lib/utils'
import { DataGridWorkspace } from '@/shared/ui/data-grid/data-grid-workspace'
import { ActivityProvider, useActivityController, useActivityData } from './activity-context'
import styles from './activity-events.module.css'
import { ActivityEventDetailSheet } from './details/activity-event-detail-sheet'
import { ActivityPurgeDialog } from './dialogs/activity-purge-dialog'
import { ActivityRetentionDialog } from './dialogs/activity-retention-dialog'
import { ActivityFilterPanel } from './filters/activity-filter-panel'
import { ActivitySummary } from './summary/activity-summary'
import { ActivityEventsDataTable } from './table/activity-events-data-table'
import { ActivityEventsPagination } from './table/activity-events-pagination'
import { ActivityEventsActions, ActivityEventsRefresh } from './table/activity-events-toolbar'
import type { ActivityEventsTableProps } from './activity-types'

const ActivityEventsContent = () => {
  const controller = useActivityController()
  const { application, filters, loading } = useActivityData()
  const activeFilters = controller.activeFilters.filter(
    filter => filter.key !== 'search' && (!application || !['resourceType', 'resourceId'].includes(filter.key))
  )
  return (
    <>
      <ActivitySummary />
      <Section
        surface='plain'
        className={cn(styles.activity, application && styles.appActivity)}
        aria-label={application ? 'App activity' : undefined}
        headingSpacing='default'
        contentClassName='gap-4'
      >
        <DataGridWorkspace
          columnsInToolbar
          disabled={loading}
          search={controller.localFilters.search ?? ''}
          appliedSearch={filters.search ?? ''}
          searchPlaceholder={application ? 'Search activity' : 'Search audit log'}
          searchLabel='Search actor, action, resource, or details'
          onSearchChange={controller.setSearchDraft}
          onSearch={value => controller.setFilterValue('search', value.trim() || undefined)}
          filters={application ? undefined : <ActivityFilterPanel />}
          filterTitle='Filter activity'
          filterDescription='Narrow events by actor, type, target, outcome, or time range.'
          activeFilters={activeFilters.map(filter => ({
            ...filter,
            id: filter.key,
            onRemove: () => controller.removeFilter(filter.key)
          }))}
          onResetFilters={controller.resetFilters}
          searchActions={application ? <ActivityEventsActions /> : undefined}
          actions={application ? undefined : <ActivityEventsActions />}
          refresh={application ? undefined : <ActivityEventsRefresh />}
        >
          <ActivityEventsDataTable />
          <ActivityEventsPagination />
        </DataGridWorkspace>
      </Section>

      <ActivityEventDetailSheet />
      {!application ? <ActivityRetentionDialog /> : null}
      {!application ? <ActivityPurgeDialog /> : null}
    </>
  )
}

export const ActivityEventsTable = (props: ActivityEventsTableProps) => (
  <ActivityProvider
    key={props.application?.id ?? 'audit-log'}
    value={props}
  >
    <ActivityEventsContent />
  </ActivityProvider>
)
