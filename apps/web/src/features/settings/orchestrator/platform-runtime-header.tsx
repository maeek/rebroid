import { IconDeviceFloppy, IconRestore } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { MutationButton } from '@/components/ui/mutation-button'
import { PageHeader } from '@/shared/ui/page/page-header'

export const PlatformRuntimeHeader = ({
  isSaving,
  onReset,
  onSave,
  showActions = true
}: {
  isSaving: boolean
  onReset: () => void
  onSave: () => void
  showActions?: boolean
}) => {
  return (
    <PageHeader
      section={{ label: 'Platform', href: '/platform' }}
      title='Runtime defaults'
      description='Default runtime settings and maintenance actions for managed Android containers.'
      actions={
        showActions ? (
          <>
            <Button
              variant='ghost'
              disabled={isSaving}
              onClick={onReset}
            >
              <IconRestore className='size-4' />
              Reset
            </Button>
            <MutationButton
              pending={isSaving}
              pendingLabel='Saving…'
              onClick={onSave}
            >
              <IconDeviceFloppy className='size-4' />
              Save
            </MutationButton>
          </>
        ) : null
      }
    />
  )
}
