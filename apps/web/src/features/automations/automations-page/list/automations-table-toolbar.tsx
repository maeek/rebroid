import { IconTrash } from '@tabler/icons-react'
import { DataGridToolbar } from '@/components/data-grid'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { allFilterValue } from '../shared/grid-query-utils'
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
        <Select
          value={gridQuery.tag ?? allFilterValue}
          onValueChange={value => onUpdateGrid({ tag: value === allFilterValue ? undefined : value, page: 1 })}
        >
          <SelectTrigger className='w-full'>
            <SelectValue placeholder='Tag' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={allFilterValue}>All tags</SelectItem>
            {automationsPage.facets.tags.map(tag => (
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
            <SelectValue placeholder='App' />
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
          value={gridQuery.status ?? allFilterValue}
          onValueChange={value =>
            onUpdateGrid({
              status: value === allFilterValue ? undefined : (value as AutomationsGridQuery['status']),
              page: 1
            })
          }
        >
          <SelectTrigger className='w-full'>
            <SelectValue placeholder='Status' />
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
              lastRun: value === allFilterValue ? undefined : (value as AutomationsGridQuery['lastRun']),
              page: 1
            })
          }
        >
          <SelectTrigger className='w-full'>
            <SelectValue placeholder='Last run' />
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
