import { IconCalendarStats, IconClock, IconDatabaseExport, IconShieldCheck } from '@tabler/icons-react'
import { useActivityData } from '../activity-context'
import { metricNumber, relativeTime } from '../activity-format'

export const ActivitySummaryCards = () => {
  const { result, auditRetentionDays } = useActivityData()

  return (
    <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-4'>
      <div className='rounded-xl border border-border/70 bg-card/45 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]'>
        <div className='flex items-center justify-between text-sm text-secondary-foreground'>
          Matching events
          <IconDatabaseExport className='size-4' />
        </div>
        <div className='mt-3 text-3xl font-semibold'>{metricNumber(result.total)}</div>
        <div className='mt-1 text-xs text-secondary-foreground'>Current filtered view</div>
      </div>
      <div className='rounded-xl border border-border/70 bg-card/45 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]'>
        <div className='flex items-center justify-between text-sm text-secondary-foreground'>
          Failures
          <IconShieldCheck className='size-4' />
        </div>
        <div className='mt-3 text-3xl font-semibold'>{metricNumber(result.summary.failure)}</div>
        <div className='mt-1 text-xs text-secondary-foreground'>{metricNumber(result.summary.success)} successful</div>
      </div>
      <div className='rounded-xl border border-border/70 bg-card/45 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]'>
        <div className='flex items-center justify-between text-sm text-secondary-foreground'>
          Last event
          <IconClock className='size-4' />
        </div>
        <div className='mt-3 text-2xl font-semibold'>{relativeTime(result.summary.lastEventAt)}</div>
        <div className='mt-1 text-xs text-secondary-foreground'>
          {result.summary.lastEventAt ? new Date(result.summary.lastEventAt).toLocaleString() : 'No timestamp'}
        </div>
      </div>
      <div className='rounded-xl border border-border/70 bg-card/45 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]'>
        <div className='flex items-center justify-between text-sm text-secondary-foreground'>
          Retention
          <IconCalendarStats className='size-4' />
        </div>
        <div className='mt-3 text-3xl font-semibold'>{auditRetentionDays} days</div>
        <div className='mt-1 text-xs text-secondary-foreground'>Automatic cleanup window</div>
      </div>
    </div>
  )
}
