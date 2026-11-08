import { IconDeviceFloppy } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { MutationButton } from '@/components/ui/mutation-button'
import { Skeleton } from '@/components/ui/skeleton'

export const ServicesPageActions = ({
  hasChanges = false,
  saving = false,
  disabled = false,
  onDiscard,
  onSave
}: {
  hasChanges?: boolean
  saving?: boolean
  disabled?: boolean
  onDiscard?: () => void
  onSave?: () => void
}) => (
  <>
    <Button
      type='button'
      variant='ghost'
      disabled={disabled || saving || !hasChanges}
      onClick={onDiscard}
    >
      Discard changes
    </Button>
    <MutationButton
      type='button'
      onClick={onSave}
      pending={saving}
      pendingLabel='Saving…'
      disabled={disabled || !hasChanges}
    >
      <IconDeviceFloppy className='size-4' />
      Save
    </MutationButton>
  </>
)

export const ServicesSaveStatus = ({
  hasChanges = false,
  loading = false
}: {
  hasChanges?: boolean
  loading?: boolean
}) => (
  <span role='status'>
    {loading ? (
      <Skeleton className='h-4 w-44' />
    ) : hasChanges ? (
      'Unsaved connection changes'
    ) : (
      'All connection changes saved'
    )}
  </span>
)
