import { IconDeviceFloppy } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { MutationButton } from '@/components/ui/mutation-button'

export const ServicesPageActions = ({
  hasChanges = false,
  saving = false,
  saved = false,
  disabled = false,
  saveDisabled = false,
  onDiscard,
  onSave
}: {
  hasChanges?: boolean
  saving?: boolean
  saved?: boolean
  disabled?: boolean
  saveDisabled?: boolean
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
      success={saved}
      disabled={disabled || saveDisabled || !hasChanges}
    >
      <IconDeviceFloppy className='size-4' />
      Save
    </MutationButton>
  </>
)
