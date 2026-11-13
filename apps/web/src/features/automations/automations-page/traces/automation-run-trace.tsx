'use client'

import { useEffect, useState, useTransition } from 'react'
import { IconFileText, IconListCheck, IconListDetails, IconPlayerStop } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MutationButton } from '@/components/ui/mutation-button'
import { Notice } from '@/components/ui/notice'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TabsList, TabsPanel, TabsRoot, TabsTrigger } from '@/components/ui/tabs'
import { sendBff } from '@/lib/http/bff'
import { workflowAuthorizationFailure, workflowRunFailureMessage } from '@/shared/model/workflow-run-failure'
import { AutomationRunLiveEvents } from '@/shared/ui/automation/automation-run-live-events'
import { WorkflowRunSummaryPanel } from '@/shared/ui/automation/workflow-run-summary-panel'
import { DateTimeValue } from '@/shared/ui/date-time-value'
import { ResourceLink } from '@/shared/ui/resource-link'
import { StateView } from '@/shared/ui/state-view'
import type { AutomationRun, AutomationStepResult } from '@/shared/contracts/automation'

const triggerLabels = { manual: 'Manual', schedule: 'Scheduled', webhook: 'Webhook', event: 'Event' } as const
const ocrStepCommands = new Set(['vision.observe', 'vision.locate', 'ai.run'])

const stepResultBadge = ({ status, output }: AutomationStepResult) => {
  if (status === 'failed') {
    if (output?.commandOutcome === 'not_found') return <Badge variant='danger'>Not found</Badge>
    if (output?.commandOutcome === 'uncertain') return <Badge variant='danger'>Uncertain</Badge>
    return <Badge variant='danger'>Failed</Badge>
  }
  if (status === 'skipped') return <Badge>Skipped</Badge>
  switch (output?.commandOutcome) {
    case 'not_found':
      return <Badge>Not found</Badge>
    case 'unsupported':
      return <Badge variant='warning'>Unsupported</Badge>
    case 'uncertain':
      return <Badge variant='warning'>Uncertain</Badge>
    case 'failed':
      return <Badge variant='warning'>Command failed</Badge>
    default:
      return <Badge>Success</Badge>
  }
}

const elapsed = (start: string | null, end: string | null) => {
  if (!start || !end) return '—'
  const ms = Date.parse(end) - Date.parse(start)
  if (!Number.isFinite(ms) || ms < 0) return '—'
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`
}

export function AutomationRunTrace({ run, targetName }: { run: AutomationRun; targetName?: string }) {
  const [tab, setTab] = useState('summary')
  const [ocrStep, setOcrStep] = useState<{ stepId: string; path?: string | null }>()
  const [stopError, setStopError] = useState(false)
  const [stopPending, startStopping] = useTransition()
  const [cancelRequestedRunId, setCancelRequestedRunId] = useState<string | null>(null)
  const router = useRouter()
  const active = run.status === 'queued' || run.status === 'running'
  const stopping = active && (stopPending || cancelRequestedRunId === run.id)
  useEffect(() => {
    if (!active) return
    const interval = window.setInterval(() => router.refresh(), 5000)
    return () => window.clearInterval(interval)
  }, [active, router])
  const stop = () => {
    setStopError(false)
    startStopping(async () => {
      try {
        await sendBff(`/api/bff/automations/runs/${encodeURIComponent(run.id)}/cancel`, {})
        setCancelRequestedRunId(run.id)
        router.refresh()
      } catch {
        setStopError(true)
      }
    })
  }
  const failedStep = run.stepResults.find(step => step.status === 'failed')
  const authorizationFailure = workflowAuthorizationFailure(run.failureCode)
  const targetPath = `/app/${encodeURIComponent(run.targetApplicationId)}`
  const targetHref = `${targetPath}?view=workflows&run=${encodeURIComponent(run.id)}`
  return (
    <TabsRoot
      value={tab}
      onValueChange={setTab}
      className='grid min-w-0 gap-6'
    >
      <TabsList
        ariaLabel='Run details'
        variant='resource'
        actions={
          active ? (
            <MutationButton
              animate
              variant='secondary'
              size='sm'
              pending={stopping}
              pendingLabel='Stopping…'
              onClick={stop}
            >
              <IconPlayerStop className='size-4' /> Stop run
            </MutationButton>
          ) : undefined
        }
      >
        <TabsTrigger
          value='summary'
          icon={<IconFileText className='size-4' />}
        >
          Summary
        </TabsTrigger>
        <TabsTrigger
          value='steps'
          icon={<IconListCheck className='size-4' />}
        >
          Steps
        </TabsTrigger>
        <TabsTrigger
          value='events'
          icon={<IconListDetails className='size-4' />}
        >
          Events
        </TabsTrigger>
      </TabsList>
      {stopError ? (
        <Notice
          tone='danger'
          title='Could not stop the run'
        />
      ) : null}
      <TabsPanel
        value='summary'
        className='grid min-w-0 gap-5'
      >
        {run.status === 'failed' ? (
          <Notice
            tone='danger'
            title={
              authorizationFailure?.title ?? (failedStep ? `Step ${failedStep.stepId} failed` : 'Workflow run failed')
            }
            description={
              authorizationFailure?.description ??
              workflowRunFailureMessage(run.error ?? failedStep?.error, run.startedAt)
            }
          />
        ) : null}
        <WorkflowRunSummaryPanel
          fields={[
            { label: 'Run ID', value: run.id, copyValue: run.id, code: true },
            ...(run.failureRequestId
              ? [{ label: 'Request ID', value: run.failureRequestId, copyValue: run.failureRequestId, code: true }]
              : []),
            {
              label: 'Target app',
              value: <ResourceLink href={targetHref}>{targetName ?? run.targetApplicationId}</ResourceLink>
            },
            {
              label: 'Profile',
              value: run.targetProfileMode === 'temporary' ? 'Temporary' : (run.targetProfileName ?? 'Default')
            },
            { label: 'Trigger', value: triggerLabels[run.trigger] },
            {
              label: 'Created',
              value: (
                <DateTimeValue
                  value={run.createdAt}
                  className='text-sm text-foreground'
                  compact
                  showSeconds
                />
              )
            },
            {
              label: 'Started',
              value: (
                <DateTimeValue
                  value={run.startedAt}
                  className='text-sm text-foreground'
                  compact
                  showSeconds
                />
              )
            },
            {
              label: 'Finished',
              value: (
                <DateTimeValue
                  value={run.completedAt}
                  className='text-sm text-foreground'
                  compact
                  showSeconds
                />
              )
            },
            { label: 'Duration', value: elapsed(run.startedAt, run.completedAt) }
          ]}
        />
      </TabsPanel>
      <TabsPanel value='steps'>
        {run.stepResults.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Step</TableHead>
                <TableHead>Result</TableHead>
                <TableHead>Duration</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {run.stepResults.map((step, index) => (
                <TableRow key={`${step.path ?? step.stepId}-${index}`}>
                  <TableCell className='whitespace-normal'>
                    <span className='font-medium'>{step.stepId}</span>
                    <p className='text-xs text-foreground-muted'>{step.uses}</p>
                    {step.error ? (
                      <p className='mt-1 [overflow-wrap:anywhere]'>
                        {workflowRunFailureMessage(step.error, step.startedAt)}
                      </p>
                    ) : null}
                    {ocrStepCommands.has(step.uses) ? (
                      <Button
                        variant='ghost'
                        size='sm'
                        aria-label={`OCR events for ${step.stepId}`}
                        onClick={() => {
                          setOcrStep({ stepId: step.stepId, path: step.path })
                          setTab('events')
                        }}
                      >
                        OCR events
                      </Button>
                    ) : null}
                  </TableCell>
                  <TableCell>{stepResultBadge(step)}</TableCell>
                  <TableCell>{elapsed(step.startedAt, step.completedAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <StateView
            scope='section'
            kind='empty'
            title='No recorded steps'
            description='Any recorded execution activity appears under Events.'
          />
        )}
      </TabsPanel>
      <TabsPanel value='events'>
        {tab === 'events' ? (
          <AutomationRunLiveEvents
            run={run}
            presentation='flat'
            showHeader={false}
            allowCancel={false}
            ocrStep={ocrStep}
            onClearOcrStep={() => setOcrStep(undefined)}
          />
        ) : null}
      </TabsPanel>
    </TabsRoot>
  )
}
