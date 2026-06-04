'use client'

import { IconSearch, IconTrash } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Visible } from '@/components/ui/visible'
import type { LastRunFilter } from './automation-trigger-utils'
import type { AndroidApplication } from '@/server/orchestrator/applications/types'

export function AutomationTriggerFilters({
  applications,
  appFilter,
  enabledFilter,
  lastRunFilter,
  search,
  selectedCount,
  statusFilter,
  tagFilter,
  tags,
  onBulkDelete,
  onBulkEnabledChange,
  onFilterApp,
  onFilterEnabled,
  onFilterLastRun,
  onFilterStatus,
  onFilterTag,
  onSearchChange
}: {
  applications: AndroidApplication[]
  appFilter: string
  enabledFilter: string
  lastRunFilter: LastRunFilter
  search: string
  selectedCount: number
  statusFilter: string
  tagFilter: string
  tags: string[]
  onBulkDelete: () => void
  onBulkEnabledChange: (enabled: boolean) => void
  onFilterApp: (value: string) => void
  onFilterEnabled: (value: string) => void
  onFilterLastRun: (value: LastRunFilter) => void
  onFilterStatus: (value: string) => void
  onFilterTag: (value: string) => void
  onSearchChange: (value: string) => void
}) {
  return (
    <div className='mb-4 grid gap-4'>
      <div className='flex flex-wrap items-center gap-2'>
        <div className='relative min-w-60 flex-1'>
          <IconSearch className='pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-secondary-foreground' />
          <Input
            value={search}
            placeholder='Search triggers'
            className='pl-9'
            onChange={event => onSearchChange(event.target.value)}
          />
        </div>
        <Select
          value={tagFilter}
          onValueChange={onFilterTag}
        >
          <SelectTrigger className='w-44'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>All tags</SelectItem>
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
          value={appFilter}
          onValueChange={onFilterApp}
        >
          <SelectTrigger className='w-52'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>All apps</SelectItem>
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
          value={enabledFilter}
          onValueChange={onFilterEnabled}
        >
          <SelectTrigger className='w-36'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>Any state</SelectItem>
            <SelectItem value='true'>Enabled</SelectItem>
            <SelectItem value='false'>Disabled</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={statusFilter}
          onValueChange={onFilterStatus}
        >
          <SelectTrigger className='w-40'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>All status</SelectItem>
            <SelectItem value='never_run'>Never run</SelectItem>
            <SelectItem value='running'>Running</SelectItem>
            <SelectItem value='success'>Success</SelectItem>
            <SelectItem value='failed'>Failed</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={lastRunFilter}
          onValueChange={value => onFilterLastRun(value as LastRunFilter)}
        >
          <SelectTrigger className='w-40'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>Any run</SelectItem>
            <SelectItem value='never'>Never run</SelectItem>
            <SelectItem value='7d'>Last 7 days</SelectItem>
            <SelectItem value='30d'>Last 30 days</SelectItem>
            <SelectItem value='90d'>Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Visible when={selectedCount > 0}>
        <div className='flex flex-wrap items-center justify-between gap-3 rounded-lg border border-input bg-card/40 px-4 py-3 text-sm'>
          <span className='text-secondary-foreground'>{selectedCount} selected</span>
          <div className='flex flex-wrap gap-2'>
            <Button
              size='sm'
              variant='secondary'
              onClick={() => onBulkEnabledChange(true)}
            >
              Enable
            </Button>
            <Button
              size='sm'
              variant='secondary'
              onClick={() => onBulkEnabledChange(false)}
            >
              Disable
            </Button>
            <Button
              size='sm'
              variant='destructive'
              onClick={onBulkDelete}
            >
              <IconTrash className='size-4' />
              Delete
            </Button>
          </div>
        </div>
      </Visible>
    </div>
  )
}
