import { type ReactNode } from 'react'
import { IconTrash } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Visible } from '@/components/ui/visible'
import { DataGridWorkspace } from '@/shared/ui/data-grid'
import {
  AutomationLastRunFilter,
  AutomationLastStatusFilter,
  AutomationTagFilter,
  AutomationTargetApplicationFilter
} from '../shared/automation-grid-filter-controls'
import { allFilterValue } from '../shared/grid-query-utils'
import type { AndroidApplication } from '@/server/orchestrator/applications/types'
import type { AutomationTriggersGridQuery } from '@/server/orchestrator/automations/types'

export const AutomationTriggersToolbar = ({
  applications,
  tags,
  gridQuery,
  search,
  selectedCount,
  onSearchChange,
  onSearchSubmit,
  onUpdateGrid,
  onDelete,
  onDisable,
  onEnable,
  children
}: {
  applications: AndroidApplication[]
  tags: string[]
  gridQuery: AutomationTriggersGridQuery
  search: string
  selectedCount: number
  onSearchChange: (search: string) => void
  onSearchSubmit: (value: string) => void
  onUpdateGrid: (patch: Partial<AutomationTriggersGridQuery>) => void
  onDelete: () => void
  onDisable: () => void
  onEnable: () => void
  children: ReactNode
}) => (
  <DataGridWorkspace
    search={search}
    searchPlaceholder='Search triggers'
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
      ...(gridQuery.enabled
        ? [
            {
              id: 'enabled',
              label: 'State',
              value: gridQuery.enabled === 'true' ? 'Enabled' : 'Disabled',
              onRemove: () => onUpdateGrid({ enabled: undefined, page: 1 })
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
      onUpdateGrid({
        tag: undefined,
        targetApplicationId: undefined,
        enabled: undefined,
        status: undefined,
        lastRun: undefined,
        page: 1
      })
    }
    selectedCount={selectedCount}
    bulkActions={
      <>
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
          variant='danger'
          onClick={onDelete}
        >
          <IconTrash className='size-4' />
          Delete
        </Button>
      </>
    }
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
  >
    {children}
  </DataGridWorkspace>
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
    <div className='flex flex-wrap items-center justify-between gap-3 rounded-panel border border-surface-border bg-surface-panel/50 px-4 py-3 text-sm'>
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
          variant='danger'
          onClick={onDelete}
        >
          <IconTrash className='size-4' />
          Delete
        </Button>
      </div>
    </div>
  </Visible>
)
