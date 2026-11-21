'use client'

import { useState } from 'react'
import { IconArrowUpRight, IconFileText, IconListDetails, IconPlayerStop } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { MutationButton } from '@/components/ui/mutation-button'
import { Notice } from '@/components/ui/notice'
import { Section } from '@/components/ui/section'
import { TabsList, TabsPanel, TabsRoot, TabsTrigger } from '@/components/ui/tabs'
import { useApplicationViewerApp } from '@/features/applications/detail/application-viewer-context'
import { getBff } from '@/lib/http/bff'
import { ActionResultError } from '@/shared/actions/action-result'
import { workflowRunStepLabel } from '@/shared/model/workflow-action-presentation'
import { workflowAuthorizationFailure, workflowRunFailureMessage } from '@/shared/model/workflow-run-failure'
import { workflowTraceHref } from '@/shared/model/workflow-trace-href'
import { hasPermission } from '@/shared/permissions/permissions'
import { AutomationRunEventsPanel } from '@/shared/ui/automation/automation-run-live-events'
import { AutomationRunStatusBadge } from '@/shared/ui/automation/automation-run-status-badge'
import { useWorkflowRunUpdates } from '@/shared/ui/automation/use-workflow-run-updates'
import { WorkflowRunProgress } from '@/shared/ui/automation/workflow-run-progress'
import { WorkflowRunSummaryPanel } from '@/shared/ui/automation/workflow-run-summary-panel'
import { DateTimeValue } from '@/shared/ui/date-time-value'
import { ResourceLink } from '@/shared/ui/resource-link'
import { StateView } from '@/shared/ui/state-view'
import { workflowRunDuration, workflowRunTriggerLabels } from './app-workflow-run-presentation'
import type { ApplicationWorkflowRun } from '@/shared/contracts/application-workflow-history'

export function AppWorkflowRunDetails({ endpoint, runId }: { endpoint: string; runId: string }) {
  const { permissions } = useApplicationViewerApp()
  const [tab, setTab] = useState('summary')
  const query = useQuery({
    queryKey: ['application-workflow-run', endpoint, runId],
    queryFn: ({ signal }) => getBff<ApplicationWorkflowRun>(`${endpoint}/${encodeURIComponent(runId)}`, signal),
    refetchOnMount: 'always',
    retry: false
  })
  const accessLost =
    query.error instanceof ActionResultError &&
    ['unauthenticated', 'forbidden', 'not_found'].includes(query.error.failure.code)
  const run = accessLost ? undefined : query.data
  const { feed, active, stopping, stop, stopError } = useWorkflowRunUpdates(run, tab === 'events', () =>
    query.refetch({ throwOnError: true })
  )
  if (!run) {
    const unavailable = query.error instanceof ActionResultError && query.error.failure.code === 'not_found'
    return query.error ? (
      <StateView
        scope='grid'
        kind='error'
        title={unavailable ? 'Workflow run not found' : 'Could not load workflow run'}
        description={unavailable ? 'This run is unavailable for this app.' : query.error.message}
        actions={unavailable ? undefined : [{ label: 'Retry', onClick: () => void query.refetch() }]}
      />
    ) : (
      <AppWorkflowRunDetailsLoading />
    )
  }

  return (
    <Section
      title={run.automationName ?? 'Deleted workflow'}
      surface='plain'
      headingSpacing='compact'
      titleClassName='flex-wrap items-center gap-x-3 gap-y-2'
      actions={
        <div className='flex flex-wrap items-center gap-2'>
          <AutomationRunStatusBadge
            runId={run.id}
            status={stopping ? 'canceling' : feed.status}
          />
          {run.automationName && hasPermission(permissions, 'automations:manage') ? (
            <ResourceLink
              href={workflowTraceHref(run.automationId, run.id)}
              aria-label='Open full trace'
              className='touch-control inline-flex items-center gap-1 py-1.5 text-sm font-medium'
            >
              Full trace
              <IconArrowUpRight
                className='size-3.5'
                aria-hidden
              />
            </ResourceLink>
          ) : null}
          {active ? (
            <MutationButton
              animate
              variant='secondary'
              size='sm'
              pending={stopping}
              pendingLabel='Stopping…'
              onClick={() => void stop()}
            >
              <IconPlayerStop />
              Stop run
            </MutationButton>
          ) : null}
        </div>
      }
    >
      {query.error ? (
        <Notice
          title='Could not refresh workflow run'
          tone='warning'
        />
      ) : null}
      {stopError ? (
        <Notice
          title='Could not stop workflow run'
          description={stopError.message}
          tone='danger'
        />
      ) : null}
      <TabsRoot
        value={tab}
        onValueChange={setTab}
        className='grid min-w-0 gap-3'
      >
        <TabsList
          ariaLabel='Run details'
          variant='resource'
          className='w-fit max-w-full'
        >
          <TabsTrigger
            value='summary'
            icon={<IconFileText className='size-4' />}
          >
            Summary
          </TabsTrigger>
          <TabsTrigger
            value='events'
            icon={<IconListDetails className='size-4' />}
          >
            Events
          </TabsTrigger>
        </TabsList>
        <TabsPanel
          value='summary'
          className='grid min-w-0 gap-3'
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
          <AppWorkflowRunSummary run={run} />
        </TabsPanel>
        <TabsPanel value='events'>
          {tab === 'events' ? (
            <AutomationRunEventsPanel
              run={run}
              feed={feed}
            />
          ) : null}
        </TabsPanel>
      </TabsRoot>
    </Section>
  )
}

const AppWorkflowRunSummary = ({ run }: { run: ApplicationWorkflowRun }) => {
  const failureIndex = run.stepResults.findIndex(step => step.status === 'failed')
  const failedStep = run.stepResults[failureIndex]
  const authorizationFailure = workflowAuthorizationFailure(run.failureCode)
  const profile = run.targetProfileMode === 'temporary' ? 'Temporary' : (run.targetProfileName ?? 'Default')
  return (
    <>
      {run.status === 'failed' ? (
        <Notice
          title={authorizationFailure?.title ?? 'Workflow run failed'}
          description={
            authorizationFailure?.description ??
            workflowRunFailureMessage(failedStep?.error ?? run.error, run.startedAt)
          }
          tone='danger'
        >
          {failedStep ? (
            <p>
              Failed step {failureIndex + 1} · {workflowRunStepLabel(failedStep.uses)}
            </p>
          ) : null}
        </Notice>
      ) : null}
      <WorkflowRunSummaryPanel
        compact
        fields={[
          { label: 'Run ID', value: run.id, copyValue: run.id, code: true },
          ...(run.failureRequestId
            ? [{ label: 'Request ID', value: run.failureRequestId, copyValue: run.failureRequestId, code: true }]
            : []),
          ...(failedStep
            ? [{ label: 'Failed step ID', value: failedStep.stepId, copyValue: failedStep.stepId, code: true }]
            : []),
          {
            label: 'Created',
            value: (
              <DateTimeValue
                value={run.createdAt}
                compact
              />
            )
          },
          {
            label: 'Started',
            value: (
              <DateTimeValue
                value={run.startedAt}
                compact
              />
            )
          },
          {
            label: 'Finished',
            value: (
              <DateTimeValue
                value={run.completedAt}
                compact
              />
            )
          },
          { label: 'Duration', value: workflowRunDuration(run.startedAt, run.completedAt) },
          { label: 'Trigger', value: workflowRunTriggerLabels[run.trigger] ?? run.trigger },
          { label: 'Profile', value: profile }
        ]}
      />
    </>
  )
}

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
