import { IconDeviceFloppy } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { MutationButton } from '@/components/ui/mutation-button'
import { PageHeader } from '@/shared/ui/page/page-header'

export const PlatformRuntimeHeader = ({
  isSaving = false,
  hasChanges = false,
  onDiscard,
  disabled = false,
  showActions = true
}: {
  isSaving?: boolean
  hasChanges?: boolean
  onDiscard?: () => void
  disabled?: boolean
  showActions?: boolean
}) => (
  <PageHeader
    section={{ label: 'Platform', href: '/platform' }}
    title='Runtime defaults'
    description='Configure app defaults and manage runtime maintenance.'
    actions={
      showActions ? (
        <>
          <Button
            variant='ghost'
            disabled={disabled || isSaving || !hasChanges}
            onClick={onDiscard}
          >
            Discard changes
          </Button>
          <MutationButton
            pending={isSaving}
            pendingLabel='Saving…'
            disabled={disabled || !hasChanges}
            type='submit'
            form='runtime-defaults-form'
          >
            <IconDeviceFloppy className='size-4' />
            Save
          </MutationButton>
        </>
      ) : null
    }
  />
)
