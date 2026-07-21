import { type ReactNode } from 'react'
import { IconTrash } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { DataGridWorkspace } from '@/shared/ui/data-grid/data-grid-workspace'
import {
  AutomationLastRunFilter,
  AutomationLastStatusFilter,
  AutomationTagFilter,
  AutomationTargetApplicationFilter
} from '../shared/automation-grid-filter-controls'
import type { AndroidApplication } from '@/shared/contracts/application'
import type { AutomationsGridPage, AutomationsGridQuery } from '@/shared/contracts/automation'

export const AutomationsTableToolbar = ({
  applications,
  automationsPage,
  gridQuery,
  search,
  selectedCount,
  busy,
  onBulkDelete,
  onSearchChange,
  onSearchSubmit,
  onUpdateGrid,
  children
}: {
  applications: AndroidApplication[]
  automationsPage: AutomationsGridPage
  gridQuery: AutomationsGridQuery
  search: string
  selectedCount: number
  busy: boolean
  onBulkDelete: () => void
  onSearchChange: (search: string) => void
  onSearchSubmit: (value: string) => void
  onUpdateGrid: (patch: Partial<AutomationsGridQuery>) => void
  children: ReactNode
}) => (
  <DataGridWorkspace
    search={search}
    searchPlaceholder='Search workflows'
    onSearchChange={onSearchChange}
    onSearch={onSearchSubmit}
    activeFilters={[
      ...(gridQuery.tag
        ? [{ id: 'tag', label: 'Tag', value: gridQuery.tag, onRemove: () => onUpdateGrid({ tag: undefined, page: 1 }) }]
        : []),
      ...(gridQuery.targetApplicationId
        ? [
            {
              id: 'target',
              label: 'Target',
              value: gridQuery.targetApplicationId,
              onRemove: () => onUpdateGrid({ targetApplicationId: undefined, page: 1 })
            }
          ]
        : []),
      ...(gridQuery.status
        ? [
            {
              id: 'status',
              label: 'Status',
              value: gridQuery.status,
              onRemove: () => onUpdateGrid({ status: undefined, page: 1 })
            }
          ]
        : []),
      ...(gridQuery.lastRun
        ? [
            {
              id: 'lastRun',
              label: 'Last run',
              value: gridQuery.lastRun,
              onRemove: () => onUpdateGrid({ lastRun: undefined, page: 1 })
            }
          ]
        : [])
    ]}
    onResetFilters={() =>
      onUpdateGrid({ tag: undefined, targetApplicationId: undefined, status: undefined, lastRun: undefined, page: 1 })
    }
    selectedCount={selectedCount}
    bulkActions={
      <Button
        size='sm'
        variant='danger'
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
  >
    {children}
  </DataGridWorkspace>
)
