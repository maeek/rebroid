import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { AndroidApplication } from '@/server/orchestrator/applications/types'
import type { AutomationRun, AutomationRunStatus } from '@/server/orchestrator/automations/types'

const statusVariant = (status: AutomationRunStatus) =>
  status === 'failed' || status === 'canceled' ? 'destructive' : status === 'success' ? 'status' : 'secondary'

const dateLabel = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short'
      }).format(new Date(value))
    : '-'

const durationLabel = (run: AutomationRun) => {
  if (!run.startedAt || !run.completedAt) return '-'

  const durationMs = new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()
  if (!Number.isFinite(durationMs) || durationMs < 0) return '-'
  if (durationMs < 1000) return `${durationMs} ms`

  return `${(durationMs / 1000).toFixed(1)} s`
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

export function AutomationTracesSection({
  applications,
  runs
}: {
  applications: AndroidApplication[]
  runs: AutomationRun[]
}) {
  const applicationById = new Map(applications.map(application => [application.id, application]))

  return (
    <section className='grid gap-3'>
      <div className='flex h-8 items-center justify-between gap-3'>
        <h3 className='text-xl font-medium'>Traces</h3>
      </div>

      <div className='overflow-hidden rounded-lg border border-border/60 bg-background/25'>
        <div className='overflow-x-auto'>
          <Table
            className='table-fixed'
            style={{ minWidth: '72rem' }}
          >
            <TableHeader className='bg-background/45'>
              <TableRow className='hover:bg-transparent'>
                <TableHead className='w-44 px-4 py-3 uppercase'>Started</TableHead>
                <TableHead className='w-36 px-4 py-3 uppercase'>Source</TableHead>
                <TableHead className='w-[20rem] px-4 py-3 uppercase'>Target</TableHead>
                <TableHead className='w-40 px-4 py-3 uppercase'>Steps</TableHead>
                <TableHead className='w-28 px-4 py-3 uppercase'>Duration</TableHead>
                <TableHead className='w-32 px-4 py-3 uppercase'>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className='px-4 py-4 text-sm text-secondary-foreground'
                  >
                    No traces yet. Run this flow from an app or trigger to inspect execution history here.
                  </TableCell>
                </TableRow>
              ) : (
                runs.map(run => {
                  const application = applicationById.get(run.targetApplicationId)

                  return (
                    <TableRow key={run.id}>
                      <TableCell className='px-4 py-3 align-top text-sm text-secondary-foreground'>
                        {dateLabel(run.startedAt ?? run.createdAt)}
                      </TableCell>
                      <TableCell className='px-4 py-3 align-top text-sm text-secondary-foreground'>
                        {triggerLabel(run)}
                      </TableCell>
                      <TableCell className='px-4 py-3 align-top'>
                        <div className='grid gap-1 text-sm'>
                          <span className='truncate text-foreground'>
                            {application?.name ?? run.targetApplicationId}
                          </span>
                          <span className='truncate text-secondary-foreground'>
                            {run.targetProfileName ?? 'default'} / {run.targetProfileMode ?? 'persistent'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className='px-4 py-3 align-top text-sm text-secondary-foreground'>
                        {stepProgressLabel(run)}
                      </TableCell>
                      <TableCell className='px-4 py-3 align-top text-sm text-secondary-foreground'>
                        {durationLabel(run)}
                      </TableCell>
                      <TableCell className='px-4 py-3 align-top'>
                        <div className='grid gap-1'>
                          <Badge
                            variant={statusVariant(run.status)}
                            className='w-fit capitalize'
                          >
                            {run.status}
                          </Badge>
                          {run.error ? <span className='truncate text-xs text-destructive'>{run.error}</span> : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </section>
  )
}
