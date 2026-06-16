import { IconTrash } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { DataGridToolbar } from '@/shared/ui/data-grid'
import {
  AutomationLastRunFilter,
  AutomationLastStatusFilter,
  AutomationTagFilter,
  AutomationTargetApplicationFilter
} from '../shared/automation-grid-filter-controls'
import type { AndroidApplication } from '@/server/orchestrator/applications/types'
import type { AutomationsGridPage, AutomationsGridQuery } from '@/server/orchestrator/automations/types'

export const AutomationsTableToolbar = ({
  applications,
  automationsPage,
  gridQuery,
  search,
  activeFilterCount,
  selectedCount,
  busy,
  onBulkDelete,
  onSearchChange,
  onSearchSubmit,
  onUpdateGrid
}: {
  applications: AndroidApplication[]
  automationsPage: AutomationsGridPage
  gridQuery: AutomationsGridQuery
  search: string
  activeFilterCount: number
  selectedCount: number
  busy: boolean
  onBulkDelete: () => void
  onSearchChange: (search: string) => void
  onSearchSubmit: () => void
  onUpdateGrid: (patch: Partial<AutomationsGridQuery>) => void
}) => (
  <DataGridToolbar
    search={search}
    searchPlaceholder='Search workflows'
    onSearchChange={onSearchChange}
    onSearchSubmit={onSearchSubmit}
    activeFilterCount={activeFilterCount}
    selectedCount={selectedCount}
    actions={
      <Button
        size='sm'
        variant='destructive'
        disabled={busy || selectedCount === 0}
        onClick={onBulkDelete}
      >
        <IconTrash className='size-4' />
        Delete
      </Button>
    }
    filters={
      <>
        <AutomationTagFilter
          tags={automationsPage.facets.tags}
          value={gridQuery.tag}
          onChange={tag => onUpdateGrid({ tag, page: 1 })}
        />
        <AutomationTargetApplicationFilter
          applications={applications}
          value={gridQuery.targetApplicationId}
          onChange={targetApplicationId => onUpdateGrid({ targetApplicationId, page: 1 })}
        />
        <AutomationLastStatusFilter
          value={gridQuery.status}
          onChange={status => onUpdateGrid({ status, page: 1 })}
        />
        <AutomationLastRunFilter
          value={gridQuery.lastRun}
          onChange={lastRun => onUpdateGrid({ lastRun, page: 1 })}
        />
      </>
    }
  />
)
