'use client'

import { Section } from '@/components/ui/section'
import { ActivityProvider } from './activity-context'
import { ActivityEventDetailSheet } from './details/activity-event-detail-sheet'
import { ActivityPurgeDialog } from './dialogs/activity-purge-dialog'
import { ActivityRetentionDialog } from './dialogs/activity-retention-dialog'
import { ActivityFilterSheet } from './filters/activity-filter-sheet'
import { ActivitySummaryCards } from './summary/activity-summary-cards'
import { ActivityEventsDataTable } from './table/activity-events-data-table'
import { ActivityEventsPagination } from './table/activity-events-pagination'
import { ActivityEventsToolbar } from './table/activity-events-toolbar'
import type { ActivityEventsTableProps } from './activity-types'

const ActivityEventsContent = () => {
  return (
    <>
      <ActivitySummaryCards />
      <Section
        title={
          <div>
            <div>Audit trail</div>
            <div className='mt-1 text-sm font-normal text-secondary-foreground'>
              Search, filter, export, and inspect administrative activity.
            </div>
          </div>
        }
        contentClassName='gap-4'
      >
        <ActivityEventsToolbar />
        <ActivityEventsDataTable />
        <ActivityEventsPagination />
      </Section>

      <ActivityEventDetailSheet />
      <ActivityFilterSheet />
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
