'use client'

import { useEffect, useMemo, useState } from 'react'
import { IconRefresh, IconRobot } from '@tabler/icons-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AutomationRunLiveEvents } from '@/features/automations/automations-page/traces/automation-run-live-events'
import { AppAutomationRunAction } from '@/features/applications/viewer/actions/app-automation-run-action'
import { cn } from '@/lib/utils'
import { listActiveAutomationRunsAction } from '@/server/orchestrator/automations/automation-run-actions'
import type { AppDefinition } from '@/features/applications/domain/app-definition'
import type { AutomationRun } from '@/server/orchestrator/automations/types'

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

  const loadRuns = async () => {
    setIsRefreshing(true)
    try {
      const activeRuns = await listActiveAutomationRunsAction()
      setRuns(activeRuns.filter(run => run.targetApplicationId === app.id))
    } finally {
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    void loadRuns()
    const timer = window.setInterval(() => void loadRuns(), 5000)
    return () => window.clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app.id])

  useEffect(() => {
    if (latestRun) {
      setRuns(current => [latestRun, ...current.filter(run => run.id !== latestRun.id)])
      setSelectedRunId(latestRun.id)
    }
  }, [latestRun])

  const visibleRuns = useMemo(() => {
    const byId = new Map<string, AutomationRun>()
    for (const run of runs) byId.set(run.id, run)
    if (latestRun) byId.set(latestRun.id, latestRun)
    return [...byId.values()].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
  }, [latestRun, runs])
  const selectedRun = visibleRuns.find(run => run.id === selectedRunId) ?? visibleRuns[0] ?? null

  return (
    <section className={cn('grid gap-4 rounded-md border border-border/70 bg-background/35 p-4', className)}>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div className={cn('flex items-center gap-2', hideHeader && 'sr-only')}>
          <IconRobot className='size-4 text-primary' />
          <div>
            <h3 className='text-sm font-semibold'>Automations</h3>
            <p className='text-xs text-secondary-foreground'>Active automation runs for this application.</p>
          </div>
        </div>
        <div className='flex items-center gap-2'>
          <AppAutomationRunAction onRunStarted={onRunStarted} />
          <Button
            type='button'
            variant='secondary'
            disabled={isRefreshing}
            onClick={() => void loadRuns()}
          >
            <IconRefresh className='size-4' />
            Refresh
          </Button>
        </div>
      </div>
      {visibleRuns.length === 0 ? (
        <div
          className={cn(
            'text-sm text-secondary-foreground',
            hideHeader ? 'py-2' : 'rounded-md border border-dashed border-border/70 p-3'
          )}
        >
          No active automation runs for this app.
        </div>
      ) : (
        <div className='grid gap-3 lg:grid-cols-[minmax(14rem,18rem)_minmax(0,1fr)]'>
          <div className='grid content-start gap-2'>
            {visibleRuns.map(run => (
              <button
                key={run.id}
                type='button'
                className={cn(
                  'grid gap-1 rounded-md border px-3 py-2 text-left text-sm transition',
                  selectedRun?.id === run.id
                    ? 'border-primary/35 bg-primary/10'
                    : 'border-border/70 bg-background/25 hover:bg-background/40'
                )}
                onClick={() => setSelectedRunId(run.id)}
              >
                <span className='flex items-center justify-between gap-2'>
                  <span className='font-medium'>Run {run.id.slice(0, 8)}</span>
                  <Badge
                    variant={run.status === 'failed' || run.status === 'canceled' ? 'destructive' : 'secondary'}
                    className='capitalize'
                  >
                    {run.status}
                  </Badge>
                </span>
                <span className='truncate text-xs text-secondary-foreground'>{run.trigger}</span>
              </button>
            ))}
          </div>
          {selectedRun ? (
            <AutomationRunLiveEvents
              run={selectedRun}
              compact
            />
          ) : null}
        </div>
      )}
    </section>
  )
}
