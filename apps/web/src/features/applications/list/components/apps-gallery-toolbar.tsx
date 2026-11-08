'use client'

import type { ReactNode } from 'react'
import { IconCheck, IconPlayerStopFilled, IconTrash } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DataGridWorkspace } from '@/shared/ui/data-grid/data-grid-workspace'
import { useAppsListContext } from './apps-list-context'
import type { AppsListSortMode } from '@/shared/model/applications/app-sort'

export const AppsGalleryToolbar = ({
  search,
  onSearchChange,
  status,
  onStatusChange,
  children,
  loading = false
}: {
  search: string
  onSearchChange: (value: string) => void
  status: string
  onStatusChange: (value: string) => void
  children: ReactNode
  loading?: boolean
}) => {
  const context = useAppsListContext()
  const {
    allSelected,
    exitManageMode,
    isBulkWorking,
    isManaging,
    openBulkAction,
    selectionCount,
    setSortMode,
    sortMode,
    startManaging,
    toggleSelectAll,
    stoppableSelectedCount,
    deletableSelectedCount
  } = context
  const bulkActions = (
    <>
      <Button
        variant='ghost'
        size='sm'
        onClick={toggleSelectAll}
        disabled={isBulkWorking}
      >
        <IconCheck className='size-4' />
        {allSelected ? 'Clear selection' : 'Select visible'}
      </Button>
      <Button
        variant='ghost'
        size='sm'
        onClick={() => openBulkAction('stop')}
        disabled={!stoppableSelectedCount || isBulkWorking}
      >
        <IconPlayerStopFilled className='size-4' />
        Stop
      </Button>
      <Button
        variant='danger-ghost'
        size='sm'
        onClick={() => openBulkAction('delete')}
        disabled={!deletableSelectedCount || isBulkWorking}
      >
        <IconTrash className='size-4' />
        Delete
      </Button>
      <Button
        variant='ghost'
        size='sm'
        onClick={exitManageMode}
        disabled={isBulkWorking}
      >
        Done
      </Button>
    </>
  )
  return (
    <AppsGalleryWorkspace
      search={search}
      onSearchChange={onSearchChange}
      status={status}
      onStatusChange={onStatusChange}
      sortMode={sortMode}
      onSortChange={setSortMode}
      loading={loading || isBulkWorking}
      selectedCount={selectionCount}
      bulkActions={bulkActions}
      manageActions={
        <Button
          variant='ghost'
          className='min-w-24'
          onClick={isManaging ? exitManageMode : startManaging}
          disabled={loading || isBulkWorking}
        >
          {isManaging ? 'Done' : 'Select apps'}
        </Button>
      }
    >
      {children}
    </AppsGalleryWorkspace>
  )
}

export const AppsGalleryWorkspace = ({
  search = '',
  onSearchChange = () => undefined,
  status = 'all',
  onStatusChange = () => undefined,
  sortMode = 'name-asc',
  onSortChange = () => undefined,
  loading = false,
  selectedCount = 0,
  bulkActions,
  manageActions,
  children
}: {
  search?: string
  onSearchChange?: (value: string) => void
  status?: string
  onStatusChange?: (value: string) => void
  sortMode?: AppsListSortMode
  onSortChange?: (value: AppsListSortMode) => void
  loading?: boolean
  selectedCount?: number
  bulkActions?: ReactNode
  manageActions?: ReactNode
  children: ReactNode
}) => (
  <DataGridWorkspace
    search={search}
    searchPlaceholder='Search apps'
    onSearchChange={onSearchChange}
    onSearch={onSearchChange}
    disabled={loading}
    toolbarLayout='compact'
    selectedCount={selectedCount}
    bulkActions={
      bulkActions ?? (
        <Button
          variant='ghost'
          size='sm'
          disabled
        >
          Done
        </Button>
      )
    }
    actions={
      <>
        <Select
          value={status}
          onValueChange={onStatusChange}
          disabled={loading}
        >
          <SelectTrigger
            className='w-44'
            aria-label='App status'
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>All statuses</SelectItem>
            <SelectItem value='running'>Running</SelectItem>
            <SelectItem value='stopped'>Stopped</SelectItem>
            <SelectItem value='error'>Needs attention</SelectItem>
            <SelectItem value='working'>In progress</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={sortMode}
          onValueChange={onSortChange}
          disabled={loading}
        >
          <SelectTrigger
            className='w-40'
            aria-label='Sort apps'
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='name-asc'>Name A–Z</SelectItem>
            <SelectItem value='name-desc'>Name Z–A</SelectItem>
            <SelectItem value='running-name'>Running first</SelectItem>
          </SelectContent>
        </Select>
        {manageActions ?? (
          <Button
            variant='ghost'
            className='min-w-24'
            disabled
          >
            Select apps
          </Button>
        )}
      </>
    }
  >
    {children}
  </DataGridWorkspace>
)
