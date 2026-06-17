import { IconDeviceFloppy, IconRestore } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { PlatformPageHeader } from '@/shared/ui/page/platform-page-header'

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
    <PlatformPageHeader
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
            <Button
              disabled={isSaving}
              onClick={onSave}
            >
              <IconDeviceFloppy className='size-4' />
              Save
            </Button>
          </>
        ) : null
      }
    />
  )
}
