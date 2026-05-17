import { IconCheck, IconPlayerStopFilled, IconTrash, IconX } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
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
    startManaging,
    stoppableSelectedCount,
    toggleSelectAll
  } = useAppsListContext()

  return (
    <>
      <div className='px-6 flex items-center justify-between gap-4 pt-2 pb-2 max-sm:px-4'>
        <AppsListTitle />
        {isManaging ? (
          <div className='flex items-center gap-2 max-sm:flex-wrap max-sm:justify-end'>
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
          </div>
        ) : (
          <Button
            variant='ghost'
            onClick={startManaging}
          >
            Manage
          </Button>
        )}
      </div>
      <Visible when={isManaging}>
        <div className='mx-6 mb-3 flex items-center justify-between gap-3 rounded-lg border border-input bg-card/40 px-4 py-3 text-sm max-sm:mx-4 max-sm:flex-col max-sm:items-start'>
          <span className='text-secondary-foreground'>
            {selectionCount} selected. Choose apps, then run a bulk action.
          </span>
          <span className='text-secondary-foreground'>
            Stop targets: {stoppableSelectedCount} - Delete targets: {deletableSelectedCount}
          </span>
        </div>
      </Visible>
    </>
  )
}
