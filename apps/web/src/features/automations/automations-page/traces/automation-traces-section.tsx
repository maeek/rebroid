'use client'

import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { AutomationRunLiveEvents } from '@/shared/ui/automation/automation-run-live-events'
import { DataGrid } from '@/shared/ui/data-grid'
import type { AndroidApplication } from '@/server/orchestrator/applications/types'
import type { AutomationRun, AutomationRunStatus } from '@/server/orchestrator/automations/types'
import type { ColumnDef, SortingState } from '@tanstack/react-table'

const statusVariant = (status: AutomationRunStatus) =>
  status === 'failed' || status === 'canceled' ? 'destructive' : status === 'success' ? 'status' : 'secondary'

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
  const applicationById = useMemo(
    () => new Map(applications.map(application => [application.id, application])),
    [applications]
  )
  const sortedRuns = useMemo(() => sortRuns(runs, sorting), [runs, sorting])
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
        meta: { label: 'Started' },
        cell: ({ row }) => (
          <span className='text-sm text-secondary-foreground'>
            {dateLabel(row.original.startedAt ?? row.original.createdAt)}
          </span>
        )
      },
      {
        id: 'trigger',
        accessorFn: triggerLabel,
        header: 'Source',
        size: 144,
        meta: { label: 'Source' },
        cell: ({ row }) => <span className='text-sm text-secondary-foreground'>{triggerLabel(row.original)}</span>
      },
      {
        id: 'target',
        accessorFn: run => applicationById.get(run.targetApplicationId)?.name ?? run.targetApplicationId,
        header: 'Target',
        size: 320,
        meta: { label: 'Target' },
        cell: ({ row }) => {
          const application = applicationById.get(row.original.targetApplicationId)
          return (
            <div className='grid gap-1 text-sm'>
              <span className='truncate text-foreground'>{application?.name ?? row.original.targetApplicationId}</span>
              <span className='truncate text-secondary-foreground'>
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
        meta: { label: 'Steps' },
        cell: ({ row }) => <span className='text-sm text-secondary-foreground'>{stepProgressLabel(row.original)}</span>
      },
      {
        id: 'duration',
        accessorFn: run => durationMs(run) ?? -1,
        header: 'Duration',
        size: 112,
        meta: { label: 'Duration' },
        cell: ({ row }) => <span className='text-sm text-secondary-foreground'>{durationLabel(row.original)}</span>
      },
      {
        id: 'status',
        accessorFn: run => run.status,
        header: 'Status',
        size: 144,
        meta: { label: 'Status' },
        cell: ({ row }) => (
          <div className='grid gap-1'>
            <Badge
              variant={statusVariant(row.original.status)}
              className='w-fit capitalize'
            >
              {row.original.status}
            </Badge>
            {row.original.error ? (
              <span className='truncate text-xs text-destructive'>{row.original.error}</span>
            ) : null}
          </div>
        )
      }
    ],
    [applicationById]
  )

  return (
    <section className='grid gap-3'>
      <div className='flex h-8 items-center justify-between gap-3'>
        <h3 className='text-xl font-medium'>Traces</h3>
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

      <DataGrid
        columns={columns}
        data={sortedRuns}
        totalItems={sortedRuns.length}
        pageIndex={0}
        pageSize={Math.max(sortedRuns.length, 1)}
        getRowId={run => run.id}
        sorting={sorting}
        onSortingChange={updater => setSorting(current => (typeof updater === 'function' ? updater(current) : updater))}
        minWidth='72rem'
        emptyState={
          <div className='text-center text-secondary-foreground'>
            No traces yet. Run this flow from an app or trigger to inspect execution history here.
          </div>
        }
      />
    </section>
  )
}
