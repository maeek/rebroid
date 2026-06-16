import { IconTrash } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Visible } from '@/components/ui/visible'
import { DataGridToolbar } from '@/shared/ui/data-grid'
import { allFilterValue } from '../shared/grid-query-utils'
import {
  AutomationLastRunFilter,
  AutomationLastStatusFilter,
  AutomationTagFilter,
  AutomationTargetApplicationFilter
} from '../shared/automation-grid-filter-controls'
import type { AndroidApplication } from '@/server/orchestrator/applications/types'
import type { AutomationTriggersGridQuery } from '@/server/orchestrator/automations/types'

export const AutomationTriggersToolbar = ({
  applications,
  tags,
  gridQuery,
  search,
  activeFilterCount,
  selectedCount,
  onSearchChange,
  onSearchSubmit,
  onUpdateGrid
}: {
  applications: AndroidApplication[]
  tags: string[]
  gridQuery: AutomationTriggersGridQuery
  search: string
  activeFilterCount: number
  selectedCount: number
  onSearchChange: (search: string) => void
  onSearchSubmit: () => void
  onUpdateGrid: (patch: Partial<AutomationTriggersGridQuery>) => void
}) => (
  <DataGridToolbar
    search={search}
    searchPlaceholder='Search triggers'
    onSearchChange={onSearchChange}
    onSearchSubmit={onSearchSubmit}
    activeFilterCount={activeFilterCount}
    selectedCount={selectedCount}
    filters={
      <>
        <AutomationTagFilter
          tags={tags}
          value={gridQuery.tag}
          onChange={tag => onUpdateGrid({ tag, page: 1 })}
        />
        <AutomationTargetApplicationFilter
          applications={applications}
          value={gridQuery.targetApplicationId}
          onChange={targetApplicationId => onUpdateGrid({ targetApplicationId, page: 1 })}
        />
        <Select
          value={gridQuery.enabled ?? allFilterValue}
          onValueChange={value =>
            onUpdateGrid({
              enabled: value === allFilterValue ? undefined : value,
              page: 1
            })
          }
        >
          <SelectTrigger className='w-full'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={allFilterValue}>Any state</SelectItem>
            <SelectItem value='true'>Enabled</SelectItem>
            <SelectItem value='false'>Disabled</SelectItem>
          </SelectContent>
        </Select>
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

export const AutomationTriggerBulkBar = ({
  selectedCount,
  onDelete,
  onDisable,
  onEnable
}: {
  selectedCount: number
  onDelete: () => void
  onDisable: () => void
  onEnable: () => void
}) => (
  <Visible when={selectedCount > 0}>
    <div className='flex flex-wrap items-center justify-between gap-3 rounded-lg border border-surface-border bg-surface-panel/50 px-4 py-3 text-sm'>
      <span className='text-foreground-muted'>{selectedCount} selected</span>
      <div className='flex flex-wrap gap-2'>
        <Button
          size='sm'
          variant='secondary'
          onClick={onEnable}
        >
          Enable
        </Button>
        <Button
          size='sm'
          variant='secondary'
          onClick={onDisable}
        >
          Disable
        </Button>
        <Button
          size='sm'
          variant='destructive'
          onClick={onDelete}
        >
          <IconTrash className='size-4' />
          Delete
        </Button>
      </div>
    </div>
  </Visible>
)
