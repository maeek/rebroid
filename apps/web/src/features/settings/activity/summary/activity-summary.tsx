import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { DateTimeValue } from '@/shared/ui/date-time-value'
import { useActivityController, useActivityData } from '../activity-context'
import { metricNumber } from '../activity-format'

export const ActivitySummary = () => {
  const { result, auditRetentionDays, application, loading } = useActivityData()
  const controller = useActivityController()
  return (
    <div
      aria-label='Activity summary'
      aria-busy={loading}
      className='flex min-w-0 flex-wrap items-center justify-between gap-x-6 gap-y-3 text-sm'
    >
      <div className='flex flex-wrap items-center gap-x-6 gap-y-2'>
        <span className='flex items-center gap-2'>
          {loading ? (
            <Skeleton className='h-4 w-12' />
          ) : (
            <strong className='font-medium tabular-nums'>{metricNumber(result.total)}</strong>
          )}
          <span className='text-foreground-muted'>matching events</span>
        </span>
        <span className='flex items-center gap-2'>
          {loading ? (
            <Skeleton className='h-4 w-8' />
          ) : (
            <strong
              className={result.summary.failure ? 'font-medium tabular-nums text-danger' : 'font-medium tabular-nums'}
            >
              {metricNumber(result.summary.failure)}
            </strong>
          )}
          <span className='text-foreground-muted'>failed</span>
        </span>
        <span className='flex flex-wrap items-center gap-2'>
          <span className='text-foreground-muted'>Latest</span>
          {loading ? (
            <Skeleton className='h-4 w-40' />
          ) : (
            <DateTimeValue
              value={result.summary.lastEventAt}
              compact
              showSeconds
              emptyLabel='No events recorded'
            />
          )}
        </span>
      </div>
      {!application ? (
        <Button
          variant='ghost'
          size='sm'
          disabled={loading || controller.isNavigating || controller.isSavingRetention || controller.isPurging}
          onClick={() => controller.setRetentionOpen(true)}
        >
          Retained for {auditRetentionDays} days
        </Button>
      ) : null}
    </div>
  )
}
