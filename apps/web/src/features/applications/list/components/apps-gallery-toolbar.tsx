'use client'

import { useId, type ReactNode } from 'react'
import { IconCheck, IconListCheck, IconPlayerStopFilled, IconTrash } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { RadioGroup, RadioOption } from '@/components/ui/radio-group'
import { DataGridWorkspace } from '@/shared/ui/data-grid/data-grid-workspace'
import { AppsGallerySortMenu } from './apps-gallery-sort-menu'
import { useAppsListContext } from './apps-list-context'
import type { AppsGalleryOwnership } from '../model/apps-gallery-filter'
import type { AppsGalleryStatus } from '@/shared/model/applications/app-gallery-status'
import type { AppsListSortMode } from '@/shared/model/applications/app-sort'

const statusLabels: Record<AppsGalleryStatus, string> = {
  all: 'All statuses',
  running: 'Running',
  stopped: 'Stopped',
  error: 'Needs attention',
  working: 'In progress'
}

const ownershipLabels: Record<AppsGalleryOwnership, string> = {
  all: 'All owners',
  mine: 'Owned by me',
  others: 'Owned by others'
}

const GalleryChoices = <Value extends string>({
  label,
  choices,
  value,
  onChange,
  disabled
}: {
  label: string
  choices: Record<Value, string>
  value: Value
  onChange: (value: Value) => void
  disabled: boolean
}) => {
  const labelId = useId()
  return (
    <div className='grid min-w-0 gap-2'>
      <span
        id={labelId}
        className='font-medium'
      >
        {label}
      </span>
      <RadioGroup
        aria-labelledby={labelId}
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        className='grid min-w-0 gap-0.5'
      >
        {(Object.keys(choices) as Value[]).map(choice => (
          <RadioOption
            key={choice}
            value={choice}
          >
            {choices[choice]}
          </RadioOption>
        ))}
      </RadioGroup>
    </div>
  )
}

const SelectAppsButton = ({
  isManaging = false,
  disabled,
  onClick
}: {
  isManaging?: boolean
  disabled: boolean
  onClick?: () => void
}) => (
  <Button
    type='button'
    variant='ghost'
    className={isManaging ? 'ml-2 max-sm:px-2.5' : 'ml-2 hidden sm:inline-flex touch:hidden'}
    aria-label={isManaging ? 'Done' : 'Select apps'}
    onClick={onClick}
    disabled={disabled}
  >
    {isManaging ? null : <IconListCheck className='size-4' />}
    {isManaging ? 'Done' : 'Select'}
  </Button>
)

export const AppsGalleryToolbar = ({
  search,
  onSearchChange,
  status,
  onStatusChange,
  ownership,
  onOwnershipChange,
  children,
  loading = false
}: {
  search: string
  onSearchChange: (value: string) => void
  status: AppsGalleryStatus
  onStatusChange: (value: AppsGalleryStatus) => void
  ownership?: AppsGalleryOwnership
  onOwnershipChange: (value: AppsGalleryOwnership) => void
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
        className='max-sm:size-8 max-sm:px-0'
        title={allSelected ? 'Clear selection' : 'Select visible'}
        onClick={toggleSelectAll}
        disabled={isBulkWorking}
      >
        <IconCheck className='size-4' />
        <span className='max-sm:sr-only'>{allSelected ? 'Clear selection' : 'Select visible'}</span>
      </Button>
      <Button
        variant='ghost'
        size='sm'
        className='max-sm:size-8 max-sm:px-0'
        title='Stop'
        onClick={() => openBulkAction('stop')}
        disabled={!stoppableSelectedCount || isBulkWorking}
      >
        <IconPlayerStopFilled className='size-4' />
        <span className='max-sm:sr-only'>Stop</span>
      </Button>
      <Button
        variant='danger-ghost'
        size='sm'
        className='max-sm:size-8 max-sm:px-0'
        title='Delete'
        onClick={() => openBulkAction('delete')}
        disabled={!deletableSelectedCount || isBulkWorking}
      >
        <IconTrash className='size-4' />
        <span className='max-sm:sr-only'>Delete</span>
      </Button>
    </>
  )
  return (
    <AppsGalleryWorkspace
      search={search}
      onSearchChange={onSearchChange}
      status={status}
      onStatusChange={onStatusChange}
      ownership={ownership}
      onOwnershipChange={onOwnershipChange}
      sortMode={sortMode}
      onSortChange={setSortMode}
      loading={loading || isBulkWorking}
      selectedCount={selectionCount}
      selectionMode={isManaging}
      bulkActions={bulkActions}
      manageActions={
        <SelectAppsButton
          isManaging={isManaging}
          onClick={isManaging ? exitManageMode : () => startManaging()}
          disabled={loading || isBulkWorking}
        />
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
  ownership,
  onOwnershipChange = () => undefined,
  sortMode = 'name-asc',
  onSortChange = () => undefined,
  loading = false,
  selectedCount = 0,
  selectionMode = false,
  bulkActions,
  manageActions,
  children
}: {
  search?: string
  onSearchChange?: (value: string) => void
  status?: AppsGalleryStatus
  onStatusChange?: (value: AppsGalleryStatus) => void
  ownership?: AppsGalleryOwnership
  onOwnershipChange?: (value: AppsGalleryOwnership) => void
  sortMode?: AppsListSortMode
  onSortChange?: (value: AppsListSortMode) => void
  loading?: boolean
  selectedCount?: number
  selectionMode?: boolean
  bulkActions?: ReactNode
  manageActions?: ReactNode
  children: ReactNode
}) => (
  <DataGridWorkspace
    className='gap-5'
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
          size='sm'
          disabled
        />
      )
    }
    selectionMode={selectionMode}
    toolbarAction={manageActions ?? <SelectAppsButton disabled />}
    searchActions={
      <AppsGallerySortMenu
        mode={sortMode}
        onChange={onSortChange}
        disabled={loading}
      />
    }
    filterTitle='Filter apps'
    filterDescription={ownership === undefined ? 'Narrow the gallery by app status.' : 'Filter by status or ownership.'}
    onResetFilters={() => {
      onStatusChange('all')
      onOwnershipChange('all')
    }}
    activeFilters={[
      ...(status === 'all'
        ? []
        : [{ id: 'status', label: 'Status', value: statusLabels[status], onRemove: () => onStatusChange('all') }]),
      ...(ownership && ownership !== 'all'
        ? [
            {
              id: 'ownership',
              label: 'Ownership',
              value: ownershipLabels[ownership],
              onRemove: () => onOwnershipChange('all')
            }
          ]
        : [])
    ]}
    filters={
      <>
        <GalleryChoices
          label='Status'
          choices={statusLabels}
          value={status}
          onChange={onStatusChange}
          disabled={loading}
        />
        {ownership !== undefined ? (
          <GalleryChoices
            label='Ownership'
            choices={ownershipLabels}
            value={ownership}
            onChange={onOwnershipChange}
            disabled={loading}
          />
        ) : null}
      </>
    }
  >
    {children}
  </DataGridWorkspace>
)
