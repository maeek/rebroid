import { IconTrash } from '@tabler/icons-react'
import { DataGridToolbar } from '@/components/data-grid'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Visible } from '@/components/ui/visible'
import { allFilterValue } from '../shared/grid-query-utils'
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
        <Select
          value={gridQuery.tag ?? allFilterValue}
          onValueChange={value => onUpdateGrid({ tag: value === allFilterValue ? undefined : value, page: 1 })}
        >
          <SelectTrigger className='w-full'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={allFilterValue}>All tags</SelectItem>
            {tags.map(tag => (
              <SelectItem
                key={tag}
                value={tag}
              >
                {tag}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={gridQuery.targetApplicationId ?? allFilterValue}
          onValueChange={value =>
            onUpdateGrid({ targetApplicationId: value === allFilterValue ? undefined : value, page: 1 })
          }
        >
          <SelectTrigger className='w-full'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={allFilterValue}>All apps</SelectItem>
            {applications.map(app => (
              <SelectItem
                key={app.id}
                value={app.id}
              >
                {app.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={gridQuery.enabled ?? allFilterValue}
          onValueChange={value =>
            onUpdateGrid({
              enabled: value === allFilterValue ? undefined : (value as AutomationTriggersGridQuery['enabled']),
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
        <Select
          value={gridQuery.status ?? allFilterValue}
          onValueChange={value =>
            onUpdateGrid({
              status: value === allFilterValue ? undefined : (value as AutomationTriggersGridQuery['status']),
              page: 1
            })
          }
        >
          <SelectTrigger className='w-full'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={allFilterValue}>All status</SelectItem>
            <SelectItem value='never_run'>Never run</SelectItem>
            <SelectItem value='running'>Running</SelectItem>
            <SelectItem value='success'>Success</SelectItem>
            <SelectItem value='failed'>Failed</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={gridQuery.lastRun ?? allFilterValue}
          onValueChange={value =>
            onUpdateGrid({
              lastRun: value === allFilterValue ? undefined : (value as AutomationTriggersGridQuery['lastRun']),
              page: 1
            })
          }
        >
          <SelectTrigger className='w-full'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={allFilterValue}>Any run</SelectItem>
            <SelectItem value='never'>Never run</SelectItem>
            <SelectItem value='7d'>Last 7 days</SelectItem>
            <SelectItem value='30d'>Last 30 days</SelectItem>
            <SelectItem value='90d'>Last 90 days</SelectItem>
          </SelectContent>
        </Select>
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
    <div className='flex flex-wrap items-center justify-between gap-3 rounded-lg border border-input bg-card/40 px-4 py-3 text-sm'>
      <span className='text-secondary-foreground'>{selectedCount} selected</span>
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
