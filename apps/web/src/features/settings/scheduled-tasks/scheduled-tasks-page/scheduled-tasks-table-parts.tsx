import { IconPlayerPlayFilled, IconTrash } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'

export const ScheduledTaskBulkBar = ({
  busy,
  canDelete,
  selectedCount,
  onDelete,
  onDisable,
  onEnable,
  onRun
}: {
  busy: boolean
  canDelete: boolean
  selectedCount: number
  onDelete: () => void
  onDisable: () => void
  onEnable: () => void
  onRun: () => void
}) =>
  selectedCount > 0 ? (
    <div className='flex flex-wrap items-center justify-between gap-3 rounded-lg border border-input bg-card/40 px-4 py-3 text-sm'>
      <span className='text-secondary-foreground'>{selectedCount} selected</span>
      <div className='flex flex-wrap gap-2'>
        <Button
          type='button'
          variant='secondary'
          disabled={busy}
          onClick={onRun}
        >
          <IconPlayerPlayFilled className='size-4' />
          Run selected
        </Button>
        <Button
          type='button'
          variant='secondary'
          disabled={busy}
          onClick={onEnable}
        >
          Enable selected
        </Button>
        <Button
          type='button'
          variant='secondary'
          disabled={busy}
          onClick={onDisable}
        >
          Disable selected
        </Button>
        <Button
          type='button'
          variant='destructive'
          disabled={busy || !canDelete}
          onClick={onDelete}
        >
          <IconTrash className='size-4' />
          Delete selected
        </Button>
      </div>
    </div>
  ) : null
