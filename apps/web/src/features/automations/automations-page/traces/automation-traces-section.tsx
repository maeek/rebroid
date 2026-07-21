'use client'

import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { FormField } from '@/components/ui/form-field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AutomationRunLiveEvents } from '@/shared/ui/automation/automation-run-live-events'
import { DataGrid } from '@/shared/ui/data-grid/data-grid'
import { DataGridWorkspace } from '@/shared/ui/data-grid/data-grid-workspace'
import type { AndroidApplication } from '@/shared/contracts/application'
import type { AutomationRun, AutomationRunStatus } from '@/shared/contracts/automation'
import type { ColumnDef, SortingState } from '@tanstack/react-table'

const statusVariant = (status: AutomationRunStatus) =>
  status === 'failed' || status === 'canceled' ? 'danger' : status === 'success' ? 'success' : 'neutral'

const dateLabel = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short'
      }).format(new Date(value))
    : '-'

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
  const success = run.stepResults.filter(step => step.status === 'success').length
  if (failed > 0) return `${success} passed, ${failed} failed`

  return `${success} completed`
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
  runs
}: {
  applications: AndroidApplication[]
  runs: AutomationRun[]
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
  const activeRuns = useMemo(
    () => sortedRuns.filter(run => run.status === 'queued' || run.status === 'running'),
    [sortedRuns]
  )

  const columns = useMemo<ColumnDef<AutomationRun>[]>(
    () => [
      {
        id: 'startedAt',
        accessorFn: run => run.startedAt ?? run.createdAt,
        header: 'Started',
        size: 176,
        meta: { label: 'Started', skeleton: { kind: 'text', width: 'w-32' } },
        cell: ({ row }) => (
          <span className='text-sm text-foreground-muted'>
            {dateLabel(row.original.startedAt ?? row.original.createdAt)}
          </span>
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
              <span className='truncate text-foreground'>{application?.name ?? row.original.targetApplicationId}</span>
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
            {row.original.error ? <span className='truncate text-xs text-danger'>{row.original.error}</span> : null}
          </div>
        )
      }
    ],
    [applicationById]
  )

  return (
    <section className='grid gap-3'>
      <div className='flex h-8 items-center justify-between gap-3'>
        <h2 className='text-xl font-medium'>Traces</h2>
      </div>

      {activeRuns.length > 0 ? (
        <div className='grid gap-3 lg:grid-cols-2'>
          {activeRuns.map(run => (
            <AutomationRunLiveEvents
              key={run.id}
              run={run}
            />
          ))}
        </div>
      ) : null}

      <DataGridWorkspace
        search={searchDraft}
        searchPlaceholder='Search traces'
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
            <div className='text-center text-foreground-muted'>
              No traces yet. Run this flow from an app or trigger to inspect execution history here.
            </div>
          }
        />
      </DataGridWorkspace>
    </section>
  )
}
