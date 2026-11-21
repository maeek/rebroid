'use client'

import { useLayoutEffect, useRef, useState, useTransition } from 'react'
import { IconFileText, IconListCheck, IconListDetails, IconPlayerStop } from '@tabler/icons-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Disclosure, DisclosureChevron, DisclosureSummary } from '@/components/ui/disclosure'
import { MutationButton } from '@/components/ui/mutation-button'
import { Notice } from '@/components/ui/notice'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TabsList, TabsPanel, TabsRoot, TabsTrigger } from '@/components/ui/tabs'
import { sendBff } from '@/lib/http/bff'
import { workflowRunStepLabel } from '@/shared/model/workflow-action-presentation'
import { workflowAuthorizationFailure, workflowRunFailureMessage } from '@/shared/model/workflow-run-failure'
import { AutomationRunEventsPanel } from '@/shared/ui/automation/automation-run-live-events'
import { useWorkflowRunUpdates } from '@/shared/ui/automation/use-workflow-run-updates'
import { WorkflowRunProgress } from '@/shared/ui/automation/workflow-run-progress'
import { WorkflowRunSummaryPanel } from '@/shared/ui/automation/workflow-run-summary-panel'
import { DateTimeValue } from '@/shared/ui/date-time-value'
import { DetailFields } from '@/shared/ui/detail-fields'
import { StateView } from '@/shared/ui/state-view'
import type { AutomationRun, AutomationStepResult } from '@/shared/contracts/automation'

const triggerLabels = { manual: 'Manual', schedule: 'Scheduled' } as const
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

export function AutomationRunTrace({
  run,
  showTargetId,
  refresh
}: {
  run: AutomationRun
  showTargetId: boolean
  refresh: () => Promise<unknown>
}) {
  const [tab, setTab] = useState('summary')
  const [ocrStep, setOcrStep] = useState<{ stepId: string; path?: string | null }>()
  const [stopError, setStopError] = useState(false)
  const [stopPending, startStopping] = useTransition()
  const [cancelRequestedRunId, setCancelRequestedRunId] = useState<string | null>(null)
  const failedRow = useRef<HTMLTableRowElement>(null)
  const jumpToFailure = useRef(false)
  const activeSnapshot = run.status === 'queued' || run.status === 'running'
  const feed = useWorkflowRunUpdates(run, activeSnapshot || tab === 'events', refresh)
  const active = feed.status === 'queued' || feed.status === 'running'
  const stopping = active && (stopPending || cancelRequestedRunId === run.id)
  const stop = () => {
    setStopError(false)
    startStopping(async () => {
      try {
        await sendBff(`/api/bff/automations/runs/${encodeURIComponent(run.id)}/cancel`, {})
      } catch {
        setStopError(true)
        return
      }
      setCancelRequestedRunId(run.id)
      await refresh().catch(() => undefined)
    })
  }
  const failureIndex = run.stepResults.findIndex(step => step.status === 'failed')
  const failedStep = run.stepResults[failureIndex]
  const authorizationFailure = workflowAuthorizationFailure(run.failureCode)
  useLayoutEffect(() => {
    if (tab === 'steps' && jumpToFailure.current) {
      jumpToFailure.current = false
      failedRow.current?.focus()
    }
  }, [tab])
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
        {tab === 'summary' ? (
          <WorkflowRunProgress
            runId={run.id}
            status={feed.status}
            events={feed.events}
            stopping={stopping}
            streamError={feed.streamError}
          />
        ) : null}
        {run.status === 'failed' ? (
          <Notice
            tone='danger'
            title={authorizationFailure?.title ?? 'Workflow run failed'}
            description={
              authorizationFailure?.description ??
              workflowRunFailureMessage(failedStep?.error ?? run.error, run.startedAt)
            }
            actions={
              failedStep ? (
                <Button
                  type='button'
                  variant='secondary'
                  size='sm'
                  onClick={() => {
                    jumpToFailure.current = true
                    setTab('steps')
                  }}
                >
                  View failed step
                </Button>
              ) : undefined
            }
          >
            {failedStep ? (
              <p>
                Failed step {failureIndex + 1} · {workflowRunStepLabel(failedStep.uses)}
              </p>
            ) : null}
          </Notice>
        ) : null}
        <WorkflowRunSummaryPanel
          fields={[
            { label: 'Run ID', value: run.id, copyValue: run.id, code: true },
            ...(run.failureRequestId
              ? [{ label: 'Request ID', value: run.failureRequestId, copyValue: run.failureRequestId, code: true }]
              : []),
            ...(showTargetId
              ? [
                  {
                    label: 'Target app ID',
                    value: run.targetApplicationId,
                    copyValue: run.targetApplicationId,
                    code: true
                  }
                ]
              : []),
            {
              label: 'Profile',
              value: run.targetProfileMode === 'temporary' ? 'Temporary' : (run.targetProfileName ?? 'Default')
            },
            { label: 'Trigger', value: triggerLabels[run.trigger] ?? run.trigger },
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
                <TableRow
                  key={`${step.path ?? step.stepId}-${index}`}
                  ref={index === failureIndex ? failedRow : undefined}
                  tabIndex={index === failureIndex ? -1 : undefined}
                  className='focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring'
                >
                  <TableCell className='whitespace-normal'>
                    <span className='font-medium'>
                      {index + 1}. {workflowRunStepLabel(step.uses)}
                    </span>
                    <Disclosure className='mt-1 text-xs text-foreground-muted'>
                      <DisclosureSummary className='flex w-fit cursor-pointer items-center gap-1 rounded-control focus-visible:outline-ring'>
                        <DisclosureChevron
                          direction='right'
                          className='size-3.5'
                        />
                        Step identifiers
                      </DisclosureSummary>
                      <DetailFields
                        compact
                        layout='list'
                        fields={[
                          { label: 'Step ID', value: step.stepId, copyValue: step.stepId },
                          { label: 'Command ID', value: step.uses, copyValue: step.uses }
                        ]}
                      />
                    </Disclosure>
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
          <AutomationRunEventsPanel
            run={run}
            feed={feed}
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
