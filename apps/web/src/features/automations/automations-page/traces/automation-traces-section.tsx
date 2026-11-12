'use client'

import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { FormField } from '@/components/ui/form-field'
import { Section } from '@/components/ui/section'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { workflowTraceHref } from '@/shared/model/workflow-trace-href'
import { DataGrid } from '@/shared/ui/data-grid/data-grid'
import { DataGridEmptyState } from '@/shared/ui/data-grid/data-grid-empty-state'
import { DataGridWorkspace } from '@/shared/ui/data-grid/data-grid-workspace'
import { DateTimeValue } from '@/shared/ui/date-time-value'
import { ResourceLink } from '@/shared/ui/resource-link'
import type { AndroidApplication } from '@/shared/contracts/application'
import type { AutomationRun, AutomationRunStatus } from '@/shared/contracts/automation'
import type { ColumnDef, SortingState } from '@tanstack/react-table'

const statusVariant = (status: AutomationRunStatus) =>
  status === 'failed' || status === 'canceled' ? 'danger' : status === 'success' ? 'success' : 'neutral'

const durationMs = (run: AutomationRun) => {
  if (!run.startedAt || !run.completedAt) return null
  const value = new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()
  return Number.isFinite(value) && value >= 0 ? value : null
}

const durationLabel = (run: AutomationRun) => {
  const value = durationMs(run)
  if (value === null) return '-'
  if (value < 1000) return `${value} ms`

  return `${(value / 1000).toFixed(1)} s`
}

const triggerLabel = (run: AutomationRun) => {
  if (run.trigger === 'manual') return 'Manual'
  if (run.trigger === 'schedule') return 'Schedule'
  if (run.trigger === 'webhook') return 'Webhook'
  return 'Event'
}

const stepProgressLabel = (run: AutomationRun) => {
  const failed = run.stepResults.filter(step => step.status === 'failed').length
  const completed = run.stepResults.filter(step => step.status === 'success').length
  if (failed > 0) return `${completed} completed, ${failed} failed`

  return `${completed} completed`
}

const runTime = (run: AutomationRun) => new Date(run.startedAt ?? run.createdAt).getTime()

const sortRuns = (runs: AutomationRun[], sorting: SortingState) => {
  const activeSorting = sorting.length > 0 ? sorting : [{ id: 'startedAt', desc: true }]
  return [...runs].sort((left, right) => {
    for (const item of activeSorting) {
      const multiplier = item.desc ? -1 : 1
      let result = 0
      if (item.id === 'startedAt') result = runTime(left) - runTime(right)
      else if (item.id === 'trigger') result = triggerLabel(left).localeCompare(triggerLabel(right))
      else if (item.id === 'target') result = left.targetApplicationId.localeCompare(right.targetApplicationId)
      else if (item.id === 'steps') result = left.stepResults.length - right.stepResults.length
      else if (item.id === 'duration') result = (durationMs(left) ?? -1) - (durationMs(right) ?? -1)
      else if (item.id === 'status') result = left.status.localeCompare(right.status)
      if (result !== 0) return result * multiplier
    }
    return left.id.localeCompare(right.id)
  })
}

export function AutomationTracesSection({
  applications,
  runs,
  workflowId,
  loading = false
}: {
  loading?: boolean
  applications: AndroidApplication[]
  runs: AutomationRun[]
  workflowId?: string
}) {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'startedAt', desc: true }])
  const [searchDraft, setSearchDraft] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [targetFilter, setTargetFilter] = useState('all')
  const applicationById = useMemo(
    () => new Map(applications.map(application => [application.id, application])),
    [applications]
  )
  const filteredRuns = useMemo(() => {
    const query = search.trim().toLowerCase()
    return runs.filter(run => {
      const target = applicationById.get(run.targetApplicationId)?.name ?? run.targetApplicationId
      if (query && !`${run.id} ${target} ${run.error ?? ''}`.toLowerCase().includes(query)) return false
      if (statusFilter !== 'all' && run.status !== statusFilter) return false
      if (sourceFilter !== 'all' && run.trigger !== sourceFilter) return false
      if (targetFilter !== 'all' && run.targetApplicationId !== targetFilter) return false
      return true
    })
  }, [applicationById, runs, search, sourceFilter, statusFilter, targetFilter])
  const sortedRuns = useMemo(() => sortRuns(filteredRuns, sorting), [filteredRuns, sorting])

  const columns = useMemo<ColumnDef<AutomationRun>[]>(
    () => [
      {
        id: 'startedAt',
        accessorFn: run => run.startedAt ?? run.createdAt,
        header: 'Run',
        size: 176,
        meta: { label: 'Run', skeleton: { kind: 'stacked' } },
        cell: ({ row }) => (
          <div className='grid justify-items-start gap-1'>
            <ResourceLink href={workflowTraceHref(workflowId ?? row.original.automationId, row.original.id)}>
              Run {row.original.id.slice(0, 8)}
            </ResourceLink>
            <DateTimeValue
              value={row.original.startedAt ?? row.original.createdAt}
              compact
            />
          </div>
        )
      },
      {
        id: 'trigger',
        accessorFn: triggerLabel,
        header: 'Source',
        size: 144,
        meta: { label: 'Source', skeleton: { kind: 'text', width: 'w-24' } },
        cell: ({ row }) => <span className='text-sm text-foreground-muted'>{triggerLabel(row.original)}</span>
      },
      {
        id: 'target',
        accessorFn: run => applicationById.get(run.targetApplicationId)?.name ?? run.targetApplicationId,
        header: 'Target',
        size: 320,
        meta: { label: 'Target', skeleton: { kind: 'stacked', secondaryHeight: 'h-5' } },
        cell: ({ row }) => {
          const application = applicationById.get(row.original.targetApplicationId)
          return (
            <div className='grid gap-1 text-sm'>
              <ResourceLink href={`/app/${encodeURIComponent(row.original.targetApplicationId)}`}>
                {application?.name ?? row.original.targetApplicationId}
              </ResourceLink>
              <span className='truncate text-foreground-muted'>
                {row.original.targetProfileName ?? 'default'} / {row.original.targetProfileMode ?? 'persistent'}
              </span>
            </div>
          )
        }
      },
      {
        id: 'steps',
        accessorFn: run => run.stepResults.length,
        header: 'Steps',
        size: 160,
        meta: { label: 'Steps', skeleton: { kind: 'text', width: 'w-24' } },
        cell: ({ row }) => <span className='text-sm text-foreground-muted'>{stepProgressLabel(row.original)}</span>
      },
      {
        id: 'duration',
        accessorFn: run => durationMs(run) ?? -1,
        header: 'Duration',
        size: 112,
        meta: { label: 'Duration', skeleton: { kind: 'text', width: 'w-20' } },
        cell: ({ row }) => <span className='text-sm text-foreground-muted'>{durationLabel(row.original)}</span>
      },
      {
        id: 'status',
        accessorFn: run => run.status,
        header: 'Status',
        size: 144,
        meta: { label: 'Status', skeleton: { kind: 'badge' } },
        cell: ({ row }) => (
          <div className='grid gap-1'>
            <Badge
              variant={statusVariant(row.original.status)}
              className='w-fit capitalize'
            >
              {row.original.status}
            </Badge>
          </div>
        )
      }
    ],
    [applicationById, workflowId]
  )

  return (
    <Section
      surface='plain'
      aria-label='Workflow executions'
      description='Select a run to inspect its steps, errors, and recorded events.'
    >
      <DataGridWorkspace
        disabled={loading}
        search={searchDraft}
        searchPlaceholder='Search runs, targets, or errors'
        onSearchChange={setSearchDraft}
        onSearch={setSearch}
        filters={
          <>
            <FormField
              label='Status'
              layout='vertical'
            >
              <Select
                value={statusFilter}
                onValueChange={setStatusFilter}
              >
                <SelectTrigger className='w-full'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>Any status</SelectItem>
                  {['queued', 'running', 'success', 'failed', 'canceled'].map(value => (
                    <SelectItem
                      key={value}
                      value={value}
                    >
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField
              label='Source'
              layout='vertical'
            >
              <Select
                value={sourceFilter}
                onValueChange={setSourceFilter}
              >
                <SelectTrigger className='w-full'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>Any source</SelectItem>
                  {['manual', 'schedule', 'webhook', 'event'].map(value => (
                    <SelectItem
                      key={value}
                      value={value}
                    >
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField
              label='Target'
              layout='vertical'
            >
              <Select
                value={targetFilter}
                onValueChange={setTargetFilter}
              >
                <SelectTrigger className='w-full'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>Any target</SelectItem>
                  {applications.map(application => (
                    <SelectItem
                      key={application.id}
                      value={application.id}
                    >
                      {application.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </>
        }
        activeFilters={[
          ...(statusFilter !== 'all'
            ? [{ id: 'status', label: 'Status', value: statusFilter, onRemove: () => setStatusFilter('all') }]
            : []),
          ...(sourceFilter !== 'all'
            ? [{ id: 'source', label: 'Source', value: sourceFilter, onRemove: () => setSourceFilter('all') }]
            : []),
          ...(targetFilter !== 'all'
            ? [
                {
                  id: 'target',
                  label: 'Target',
                  value: applicationById.get(targetFilter)?.name ?? targetFilter,
                  onRemove: () => setTargetFilter('all')
                }
              ]
            : [])
        ]}
        onResetFilters={() => {
          setStatusFilter('all')
          setSourceFilter('all')
          setTargetFilter('all')
        }}
      >
        <DataGrid
          loading={loading}
          columns={columns}
          data={sortedRuns}
          totalItems={sortedRuns.length}
          pageIndex={0}
          pageSize={Math.max(sortedRuns.length, 1)}
          getRowId={run => run.id}
          sorting={sorting}
          onSortingChange={updater =>
            setSorting(current => (typeof updater === 'function' ? updater(current) : updater))
          }
          minWidth='72rem'
          emptyState={
            <DataGridEmptyState
              title='No runs yet'
              description='Run this workflow from an app or trigger to record an execution.'
            />
          }
        />
      </DataGridWorkspace>
    </Section>
  )
}
