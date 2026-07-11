'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { IconActivity, IconRefresh, IconRobot } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { AppAutomationRunAction } from '@/features/applications/viewer/actions/app-automation-run-action'
import { cn } from '@/lib/utils'
import { listActiveAutomationRunsAction } from '@/server/orchestrator/automations/automation-run-actions'
import { AutomationRunLiveEvents } from '@/shared/ui/automation/automation-run-live-events'
import { AutomationRunStatusBadge } from '@/shared/ui/automation/automation-run-status-badge'
import type { AppDefinition } from '@/features/applications/domain/app-definition'
import type { AutomationRun, AutomationRunStatus } from '@/server/orchestrator/automations/types'

const activeStatuses = new Set<AutomationRunStatus>(['queued', 'running'])

const runTimeLabel = (run: AutomationRun) =>
  new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(run.startedAt ?? run.createdAt))

export const AutomationStatusToolsSection = ({
  app,
  latestRun,
  className,
  hideHeader,
  onRunStarted
}: {
  app: AppDefinition
  latestRun?: AutomationRun | null
  className?: string
  hideHeader?: boolean
  onRunStarted?: (run: AutomationRun) => void
}) => {
  const [runs, setRuns] = useState<AutomationRun[]>([])
  const [selectedRunId, setSelectedRunId] = useState<string | null>(latestRun?.id ?? null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const loadRuns = useCallback(async () => {
    setIsRefreshing(true)
    try {
      const activeRuns = await listActiveAutomationRunsAction()
      setRuns(current => {
        const terminalRuns = current.filter(run => !activeStatuses.has(run.status))
        const byId = new Map<string, AutomationRun>()
        for (const run of activeRuns) {
          if (run.targetApplicationId === app.id) byId.set(run.id, run)
        }
        for (const run of terminalRuns) byId.set(run.id, run)
        return [...byId.values()]
      })
      setLoadError(null)
    } catch {
      setLoadError('Workflow activity could not be refreshed.')
    } finally {
      setIsRefreshing(false)
    }
  }, [app.id])

  useEffect(() => {
    void loadRuns()
    const timer = window.setInterval(() => void loadRuns(), 5000)
    return () => window.clearInterval(timer)
  }, [loadRuns])

  useEffect(() => {
    if (latestRun) {
      setRuns(current => [latestRun, ...current.filter(run => run.id !== latestRun.id)])
      setSelectedRunId(latestRun.id)
    }
  }, [latestRun])

  const visibleRuns = useMemo(() => {
    const byId = new Map<string, AutomationRun>()
    if (latestRun) byId.set(latestRun.id, latestRun)
    for (const run of runs) byId.set(run.id, run)
    return [...byId.values()].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
  }, [latestRun, runs])
  const selectedRun = visibleRuns.find(run => run.id === selectedRunId) ?? visibleRuns[0] ?? null
  const activeRunCount = visibleRuns.filter(run => activeStatuses.has(run.status)).length

  const updateRunStatus = useCallback(
    (runId: string, status: AutomationRunStatus) => {
      setRuns(current => {
        let found = false
        const updated = current.map(run => {
          if (run.id !== runId) return run
          found = true
          return { ...run, status }
        })
        if (!found && latestRun?.id === runId) return [{ ...latestRun, status }, ...updated]
        return updated
      })
    },
    [latestRun]
  )

  return (
    <section className={cn('grid min-h-0 gap-4', className)}>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div className='flex min-w-0 items-center gap-3'>
          <span
            className={cn(
              'flex size-10 shrink-0 items-center justify-center rounded-panel border border-primary/20 bg-primary/8 text-primary',
              hideHeader && 'size-9'
            )}
          >
            <IconRobot className='size-4.5' />
          </span>
          <div className='min-w-0'>
            <div className='flex items-center gap-2'>
              <h3 className='truncate text-sm font-medium'>Workflow activity</h3>
              {activeRunCount > 0 ? (
                <span className='inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/8 px-2 py-0.5 text-xs font-medium text-primary'>
                  <span className='size-1.5 animate-pulse rounded-full bg-primary' />
                  {activeRunCount} active
                </span>
              ) : null}
            </div>
            <p className='mt-0.5 truncate text-xs text-foreground-muted'>
              Run workflows and inspect their live execution.
            </p>
          </div>
        </div>
        <div className='flex items-center gap-2'>
          <AppAutomationRunAction onRunStarted={onRunStarted} />
          <Button
            type='button'
            size='icon-md'
            variant='outline'
            className='size-9'
            aria-label='Refresh workflow runs'
            title='Refresh workflow runs'
            disabled={isRefreshing}
            onClick={() => void loadRuns()}
          >
            <IconRefresh className={cn('size-4', isRefreshing && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {loadError ? (
        <div className='rounded-panel border border-warning/25 bg-warning/8 px-3 py-2 text-xs text-warning'>
          {loadError}
        </div>
      ) : null}

      {visibleRuns.length === 0 ? (
        <div className='flex min-h-64 flex-col items-center justify-center gap-3 rounded-panel border border-dashed border-surface-border/60 bg-surface-band/14 px-6 text-center'>
          <span className='flex size-11 items-center justify-center rounded-feature border border-surface-border/55 bg-surface-panel/70 text-foreground-muted shadow-control'>
            <IconActivity className='size-5' />
          </span>
          <div className='max-w-sm'>
            <p className='text-sm font-medium text-foreground'>No workflow activity yet</p>
            <p className='mt-1 text-xs leading-5 text-foreground-muted'>
              Run a workflow to monitor its progress, tool activity, and final result here.
            </p>
          </div>
        </div>
      ) : (
        <div className='grid min-h-0 gap-3 lg:grid-cols-[minmax(17rem,20rem)_minmax(0,1fr)]'>
          <div className='grid min-h-0 content-start gap-2 rounded-panel border border-surface-border/55 bg-surface-band/18 p-2'>
            <div className='flex items-center justify-between px-1.5 pt-1 pb-0.5'>
              <span className='text-xs font-medium tracking-wide text-foreground-muted uppercase'>Runs</span>
              <span className='text-xs text-foreground-muted'>{visibleRuns.length}</span>
            </div>
            {visibleRuns.map(run => {
              const selected = selectedRun?.id === run.id
              return (
                <button
                  key={run.id}
                  type='button'
                  aria-pressed={selected}
                  className={cn(
                    'group grid gap-2 rounded-panel border px-3 py-2.5 text-left transition-[border-color,background-color,box-shadow,transform] duration-150 active:scale-[0.99]',
                    selected
                      ? 'border-primary/30 bg-primary/8 shadow-[0_10px_28px_-24px_hsl(var(--primary)/0.65)]'
                      : 'border-transparent bg-transparent hover:border-surface-border/55 hover:bg-surface-panel/50'
                  )}
                  onClick={() => setSelectedRunId(run.id)}
                >
                  <span className='flex min-w-0 items-center justify-between gap-2'>
                    <span className='truncate text-sm font-medium text-foreground'>Run {run.id.slice(0, 8)}</span>
                    <AutomationRunStatusBadge
                      status={run.status}
                      className='shrink-0'
                    />
                  </span>
                  <span className='flex min-w-0 items-center gap-1.5 text-xs text-foreground-muted'>
                    <span className='capitalize'>{run.trigger}</span>
                    <span aria-hidden='true'>·</span>
                    <span className='truncate'>{runTimeLabel(run)}</span>
                  </span>
                </button>
              )
            })}
          </div>
          {selectedRun ? (
            <AutomationRunLiveEvents
              run={selectedRun}
              compact
              onStatusChange={status => updateRunStatus(selectedRun.id, status)}
            />
          ) : null}
        </div>
      )}
    </section>
  )
}
