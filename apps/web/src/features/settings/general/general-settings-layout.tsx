import type { ReactNode } from 'react'
import { IconDeviceFloppy, IconRestore } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { MutationButton } from '@/components/ui/mutation-button'
import { EditorPage } from '@/shared/ui/page/editor-page'
import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent } from '@/shared/ui/page/page-layout'

export const GeneralSettingsLayout = ({
  children,
  loading = false,
  pending = false,
  onReset,
  onSave
}: {
  children: ReactNode
  loading?: boolean
  pending?: boolean
  onReset?: () => void
  onSave?: () => void
}) => (
  <EditorPage className='gap-2'>
    <PageHeader
      section={{ label: 'Preferences' }}
      title='General'
      actions={
        <>
          <Button
            variant='ghost'
            disabled={loading || pending}
            onClick={onReset}
          >
            <IconRestore className='size-4' />
            Reset
          </Button>
          <MutationButton
            disabled={loading}
            pending={pending}
            pendingLabel='Saving…'
            onClick={onSave}
          >
            <IconDeviceFloppy className='size-4' />
            Save
          </MutationButton>
        </>
      }
    />
    <PageContent>{children}</PageContent>
  </EditorPage>
)
