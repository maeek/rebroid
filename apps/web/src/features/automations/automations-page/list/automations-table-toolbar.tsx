import { type ReactNode } from 'react'
import { IconTrash } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { DataGridWorkspace } from '@/shared/ui/data-grid/data-grid-workspace'
import { AutomationGridFilterControls, automationGridFilterSummary } from '../shared/automation-grid-filter-controls'
import type { ApplicationName } from '@/shared/contracts/application'
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
  applications: ApplicationName[]
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
    disabled={busy}
    search={search}
    searchPlaceholder='Search workflows'
    onSearchChange={onSearchChange}
    onSearch={onSearchSubmit}
    activeFilters={automationGridFilterSummary({ applications, gridQuery, onUpdateGrid })}
    onResetFilters={() =>
      onUpdateGrid({ tag: undefined, targetDeviceId: undefined, status: undefined, lastRun: undefined, page: 1 })
    }
    selectedCount={selectedCount}
    bulkActions={
      <Button
        size='sm'
        variant='danger-ghost'
        disabled={busy || selectedCount === 0}
        onClick={onBulkDelete}
      >
        <IconTrash className='size-4' />
        Delete
      </Button>
    }
    filters={
      <AutomationGridFilterControls
        applications={applications}
        gridQuery={gridQuery}
        onUpdateGrid={onUpdateGrid}
        tags={automationsPage.facets.tags}
      />
    }
  >
    {children}
  </DataGridWorkspace>
)
