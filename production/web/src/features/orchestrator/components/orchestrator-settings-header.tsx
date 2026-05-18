import { IconDeviceFloppy, IconRotateClockwise } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Visible } from '@/components/ui/visible'
import { PageBreadcrumbs } from '@/features/shell/components/page-breadcrumbs'

export const OrchestratorSettingsHeader = ({
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
    <section className='shrink-0 px-6 py-4 max-sm:px-4'>
      <div className='flex items-center justify-between gap-3 max-sm:flex-col max-sm:items-start'>
        <div className='flex flex-col gap-2'>
          <PageBreadcrumbs
            className='pt-0'
            items={[{ label: 'Settings', href: '/settings/general' }, { label: 'Orchestrator' }]}
          />
          <h2 className='pt-4 text-3xl font-medium max-sm:text-xl'>Orchestrator</h2>
        </div>
        <Visible when={showActions}>
          <div className='flex gap-2 max-sm:w-full'>
            <Button
              variant='secondary'
              disabled={isSaving}
              onClick={onReset}
            >
              <IconRotateClockwise className='size-4' />
              Reset
            </Button>
            <Button
              disabled={isSaving}
              onClick={onSave}
            >
              <IconDeviceFloppy className='size-4' />
              Save
            </Button>
          </div>
        </Visible>
      </div>
    </section>
  )
}
