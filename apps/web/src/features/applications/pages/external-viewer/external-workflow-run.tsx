'use client'

import { useState } from 'react'
import { FormField } from '@/components/ui/form-field'
import { MutationButton } from '@/components/ui/mutation-button'
import { Notice } from '@/components/ui/notice'
import { Section } from '@/components/ui/section'
import { SingleSelectCombobox } from '@/components/ui/single-select-combobox'
import { getBff } from '@/lib/http/bff'
import { runAutomationAction } from '@/server/orchestrator/automations/automation-run-actions'
import { useWorkflowRunUpdates } from '@/shared/ui/automation/use-workflow-run-updates'
import { WorkflowRunProgress } from '@/shared/ui/automation/workflow-run-progress'
import type { AutomationRun, RunnableAutomationOption } from '@/shared/contracts/automation'

export function ExternalWorkflowRun({
  deviceId,
  attachmentId,
  workflows
}: {
  deviceId: string
  attachmentId: string
  workflows: RunnableAutomationOption[]
}) {
  const [workflow, setWorkflow] = useState('')
  const [run, setRun] = useState<AutomationRun>()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const { feed, active, stopping, stop, stopError } = useWorkflowRunUpdates(run, false, async () => {
    if (run) {
      const params = new URLSearchParams({ workflow: run.automationId, attachment: attachmentId })
      setRun(await getBff<AutomationRun>(`/api/bff/automations/runs/${encodeURIComponent(run.id)}?${params}`))
    }
  })

  const start = async () => {
    if (!workflow || pending || active) return
    setPending(true)
    setError('')
    try {
      setRun(await runAutomationAction(workflow, { targetDeviceId: deviceId, attachmentId }))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The workflow could not start.')
    } finally {
      setPending(false)
    }
  }

  return (
    <Section
      title='Run workflow'
      surface='panel'
    >
      <form
        className='grid gap-3'
        onSubmit={event => {
          event.preventDefault()
          void start()
        }}
      >
        <FormField
          label='Workflow'
          layout='vertical'
        >
          <SingleSelectCombobox
            options={workflows.map(item => ({ value: item.id, label: item.name }))}
            value={workflow}
            onValueChange={setWorkflow}
            disabled={active || pending}
            placeholder='Choose a workflow'
          />
        </FormField>
        <div className='flex flex-wrap items-center gap-2'>
          <MutationButton
            type='submit'
            pending={pending}
            pendingLabel='Queuing…'
            disabled={!workflow || active}
          >
            Run workflow
          </MutationButton>
          {active ? (
            <MutationButton
              type='button'
              variant='outline'
              pending={stopping}
              pendingLabel='Stopping…'
              onClick={() => void stop()}
            >
              Stop workflow
            </MutationButton>
          ) : null}
        </div>
        {error || stopError ? <Notice tone='danger'>{error || stopError?.message}</Notice> : null}
        {run && active ? (
          <WorkflowRunProgress
            runId={run.id}
            status={feed.status}
            events={feed.events}
            stopping={stopping}
            streamError={feed.streamError}
          />
        ) : null}
        {run?.status === 'failed' ? <Notice tone='danger'>{run.error ?? 'Workflow failed.'}</Notice> : null}
        {run?.status === 'success' ? <Notice tone='success'>Workflow completed.</Notice> : null}
        {run?.status === 'canceled' ? <Notice>Workflow canceled.</Notice> : null}
      </form>
    </Section>
  )
}
