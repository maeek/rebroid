import { IconCheck, IconPlayerStopFilled, IconTrash, IconX } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Visible } from '@/components/ui/visible'
import { useAppsListContext } from './apps-list-context'
import { AppsListTitle } from './apps-list-title'

export const AppsListHeader = () => {
  const {
    allSelected,
    deletableSelectedCount,
    exitManageMode,
    isBulkWorking,
    isManaging,
    openBulkAction,
    selectionCount,
    setSortMode,
    startManaging,
    sortMode,
    stoppableSelectedCount,
    toggleSelectAll
  } = useAppsListContext()

  return (
    <>
      <div className='px-6 flex items-center justify-between gap-4 pt-2 pb-2 max-sm:px-4'>
        <AppsListTitle />
        <div className='flex items-center gap-2 max-sm:flex-wrap max-sm:justify-end'>
          <Select
            value={sortMode}
            onValueChange={value => setSortMode(value)}
          >
            <SelectTrigger
              aria-label='Sort apps'
              size='sm'
              className='w-40 max-sm:w-36'
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent align='end'>
              <SelectItem value='name-asc'>Name A-Z</SelectItem>
              <SelectItem value='name-desc'>Name Z-A</SelectItem>
              <SelectItem value='running-name'>Running first</SelectItem>
            </SelectContent>
          </Select>
          <Visible when={isManaging}>
            <>
              <Button
                variant='secondary'
                size='sm'
                onClick={toggleSelectAll}
              >
                <IconCheck className='size-4' />
                {allSelected ? 'Clear' : 'Select all'}
              </Button>
              <Button
                variant='secondary'
                size='sm'
                disabled={stoppableSelectedCount === 0 || isBulkWorking}
                onClick={() => openBulkAction('stop')}
              >
                <IconPlayerStopFilled className='size-4' />
                Stop
              </Button>
              <Button
                variant='destructive'
                size='sm'
                disabled={deletableSelectedCount === 0 || isBulkWorking}
                onClick={() => openBulkAction('delete')}
              >
                <IconTrash className='size-4' />
                Delete
              </Button>
              <Button
                variant='ghost'
                size='sm'
                onClick={exitManageMode}
              >
                <IconX className='size-4' />
                Done
              </Button>
            </>
          </Visible>
          <Visible when={!isManaging}>
            <Button
              variant='ghost'
              onClick={startManaging}
            >
              Manage
            </Button>
          </Visible>
        </div>
      </div>
      <Visible when={isManaging}>
        <div className='mx-6 mb-3 flex items-center justify-between gap-3 rounded-lg border border-surface-border bg-surface-panel/50 px-4 py-3 text-sm max-sm:mx-4 max-sm:flex-col max-sm:items-start my-3'>
          <span className='text-foreground-muted'>{selectionCount} selected. Choose apps, then run a bulk action.</span>
          <span className='text-foreground-muted'>
            Stop targets: {stoppableSelectedCount} - Delete targets: {deletableSelectedCount}
          </span>
        </div>
      </Visible>
    </>
  )
}
