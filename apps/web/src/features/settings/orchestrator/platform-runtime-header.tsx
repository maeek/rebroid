import { IconDeviceFloppy } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { MutationButton } from '@/components/ui/mutation-button'
import { PageHeader } from '@/shared/ui/page/page-header'
import { ResourceLink } from '@/shared/ui/resource-link'

export const PlatformRuntimeHeader = ({
  isSaving = false,
  saved = false,
  hasChanges = false,
  onDiscard,
  disabled = false,
  saveDisabled = false,
  showActions = true
}: {
  isSaving?: boolean
  saved?: boolean
  hasChanges?: boolean
  onDiscard?: () => void
  disabled?: boolean
  saveDisabled?: boolean
  showActions?: boolean
}) => (
  <PageHeader
    section={{ label: 'Administration' }}
    title='General'
    description={
      <>
        Set defaults for Android apps. For shared refresh and streaming settings, see{' '}
        <ResourceLink href='/platform/console'>Console defaults</ResourceLink>.
      </>
    }
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
            success={saved}
            disabled={disabled || saveDisabled || !hasChanges}
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
