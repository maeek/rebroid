import { IconArrowLeft } from '@tabler/icons-react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Section } from '@/components/ui/section'
import { WorkflowRunSummaryPanel } from '@/shared/ui/automation/workflow-run-summary-panel'
import { AppWorkflowRunHistory } from './app-workflow-run-history'

const noop = () => undefined

export const AppWorkflowRunDetailsLoading = () => (
  <Section
    title='Run details'
    surface='plain'
    headingSpacing='compact'
  >
    <WorkflowRunSummaryPanel
      compact
      loading
      fields={['Run ID', 'Created', 'Started', 'Finished', 'Duration', 'Trigger', 'Profile'].map(label => ({
        label,
        value: null
      }))}
    />
  </Section>
)

export function AppWorkflowsLoading() {
  const runId = useSearchParams().get('run')
  return runId ? (
    <div className='grid min-w-0 gap-3'>
      <Button
        variant='ghost'
        size='sm'
        className='justify-self-start'
        disabled
      >
        <IconArrowLeft /> Run history
      </Button>
      <AppWorkflowRunDetailsLoading />
    </div>
  ) : (
    <AppWorkflowRunHistory
      loading
      href={() => '#'}
      onOpen={noop}
      launch={
        <Button
          variant='secondary'
          disabled
        >
          Run workflow
        </Button>
      }
    />
  )
}
