'use client'

import { useState } from 'react'
import { IconDeviceFloppy, IconPlayerPlayFilled } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { MutationButton } from '@/components/ui/mutation-button'
import { OperationProgress } from '@/components/ui/operation-progress'
import { Section } from '@/components/ui/section'
import { useSaveFeedback } from '@/hooks/use-save-feedback'
import { AutomationRunStatusBadge } from '@/shared/ui/automation/automation-run-status-badge'
import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent, StandardPage } from '@/shared/ui/page/page-layout'
import type { AutomationRunStatus } from '@/shared/contracts/automation'

export const ActionFeedbackPreview = () => {
  const [draft, setDraft] = useState('My app')
  const [pending, setPending] = useState(false)
  const feedback = useSaveFeedback(draft)
  const [runStatus, setRunStatus] = useState<AutomationRunStatus>('queued')
  const [progress, setProgress] = useState(20)

  return (
    <StandardPage>
      <PageHeader title='Action feedback preview' />
      <PageContent>
        <Section
          title='Save feedback'
          surface='panel'
          contentClassName='gap-4'
        >
          <FormField
            label='Name'
            layout='vertical'
          >
            <Input
              value={draft}
              onChange={event => setDraft(event.target.value)}
            />
          </FormField>
          <div className='flex flex-wrap gap-2'>
            <MutationButton
              pending={pending}
              pendingLabel='Saving…'
              success={feedback.saved}
              onClick={() => {
                feedback.resetSaveFeedback()
                setPending(true)
              }}
            >
              <IconDeviceFloppy className='size-4' /> Save
            </MutationButton>
            <Button
              variant='secondary'
              disabled={!pending}
              onClick={() => {
                setPending(false)
                feedback.confirmSaved(draft)
              }}
            >
              Confirm save
            </Button>
            <Button
              variant='ghost'
              disabled={!pending}
              onClick={() => setPending(false)}
            >
              Fail save
            </Button>
          </div>
        </Section>
        <Section
          title='Button sizing'
          surface='panel'
          contentClassName='gap-3'
        >
          {(['sm', 'md', 'lg', 'icon-sm', 'icon-md'] as const).map(size => (
            <div
              key={size}
              data-testid={`button-sizing-${size}`}
              className='flex items-center gap-3'
            >
              <Button
                size={size}
                aria-label='Reference start'
              >
                <IconPlayerPlayFilled className='size-4' />
                {!size.startsWith('icon') && 'Start'}
              </Button>
              <MutationButton
                size={size}
                aria-label='Animated start'
                pending={false}
                pendingLabel='Recreating…'
                animate
              >
                <IconPlayerPlayFilled className='size-4' />
                {!size.startsWith('icon') && 'Start'}
              </MutationButton>
              <span className='text-sm text-foreground-muted'>{size}</span>
            </div>
          ))}
          <div
            data-testid='button-sizing-text'
            className='flex items-center gap-3'
          >
            <Button>Cancel build</Button>
            <MutationButton
              pending={false}
              pendingLabel='Cancelling…'
              animate
            >
              Cancel build
            </MutationButton>
          </div>
        </Section>
        <Section
          title='Workflow feedback'
          surface='panel'
        >
          <div className='flex flex-wrap items-center gap-3'>
            <AutomationRunStatusBadge
              runId='preview-run'
              status={runStatus}
            />
            <Button
              variant='secondary'
              onClick={() =>
                setRunStatus(current => {
                  if (current === 'queued') return 'running'
                  if (current === 'running') return 'success'
                  return 'queued'
                })
              }
            >
              Advance run
            </Button>
          </div>
        </Section>
        <Section
          title='Transfer feedback'
          surface='panel'
          contentClassName='gap-4'
        >
          <OperationProgress
            label='Download progress'
            value={progress}
          />
          <Button
            variant='secondary'
            onClick={() => setProgress(80)}
          >
            Update progress
          </Button>
        </Section>
      </PageContent>
    </StandardPage>
  )
}
