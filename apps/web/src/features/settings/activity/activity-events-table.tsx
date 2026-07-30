'use client'

import { Section } from '@/components/ui/section'
import { DataGridWorkspace } from '@/shared/ui/data-grid/data-grid-workspace'
import { ActivityProvider, useActivityController } from './activity-context'
import { ActivityEventDetailSheet } from './details/activity-event-detail-sheet'
import { ActivityPurgeDialog } from './dialogs/activity-purge-dialog'
import { ActivityRetentionDialog } from './dialogs/activity-retention-dialog'
import { ActivityFilterPanel } from './filters/activity-filter-panel'
import { ActivitySummaryCards } from './summary/activity-summary-cards'
import { ActivityEventsDataTable } from './table/activity-events-data-table'
import { ActivityEventsPagination } from './table/activity-events-pagination'
import { ActivityEventsActions } from './table/activity-events-toolbar'
import type { ActivityEventsTableProps } from './activity-types'

const ActivityEventsContent = () => {
  const controller = useActivityController()
  const activeFilters = controller.activeFilters.filter(filter => filter.key !== 'search')
  return (
    <>
      <ActivitySummaryCards />
      <Section
        surface='plain'
        title='Audit trail'
        description='Search, filter, export, and inspect administrative activity.'
        headingSpacing='default'
        contentClassName='gap-4'
      >
        <DataGridWorkspace
          search={controller.localFilters.search ?? ''}
          searchPlaceholder='Search actor, action, resource, or details'
          onSearchChange={value => controller.setLocalFilters(current => ({ ...current, search: value }))}
          onSearch={value => controller.setFilterValue('search', value.trim() || undefined)}
          filters={<ActivityFilterPanel />}
          filterTitle='Filter activity'
          filterDescription='Narrow events by actor, type, target, outcome, or time range.'
          activeFilters={activeFilters.map(filter => ({
            ...filter,
            id: filter.key,
            onRemove: () => controller.removeFilter(filter.key)
          }))}
          onResetFilters={controller.resetFilters}
          actions={<ActivityEventsActions />}
        >
          <ActivityEventsDataTable />
          <ActivityEventsPagination />
        </DataGridWorkspace>
      </Section>

      <ActivityEventDetailSheet />
      <ActivityRetentionDialog />
      <ActivityPurgeDialog />
    </>
  )
}

export const ActivityEventsTable = (props: ActivityEventsTableProps) => (
  <ActivityProvider value={props}>
    <ActivityEventsContent />
  </ActivityProvider>
)
