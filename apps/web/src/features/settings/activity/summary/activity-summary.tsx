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
      className='flex min-w-0 flex-col items-start justify-between gap-x-6 gap-y-3 text-sm xl:flex-row xl:items-center'
    >
      <div className='grid min-w-0 grid-cols-[minmax(0,max-content)_max-content] items-center gap-x-4 gap-y-2 sm:flex sm:flex-wrap sm:gap-x-6'>
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
        <span className='flex min-w-0 flex-col items-start gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2'>
          <span className='text-foreground-muted'>Latest</span>
          {loading ? (
            <Skeleton
              as='span'
              className='my-0.5 h-4 w-40 sm:my-0'
            />
          ) : (
            <DateTimeValue
              value={result.summary.lastEventAt}
              className='text-sm font-medium text-foreground'
              compact
              showSeconds
              emptyLabel='No events recorded'
            />
          )}
        </span>
        {!application ? (
          <span className='flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-2'>
            <span className='text-foreground-muted'>Retention</span>
            {loading ? (
              <Skeleton
                as='span'
                className='my-0.5 h-4 w-14 sm:my-0'
              />
            ) : (
              <strong className='font-medium tabular-nums'>
                {metricNumber(auditRetentionDays)} {auditRetentionDays === 1 ? 'day' : 'days'}
              </strong>
            )}
          </span>
        ) : null}
      </div>
      {!application ? (
        <Button
          variant='secondary'
          size='sm'
          disabled={loading || controller.isNavigating || controller.isSavingRetention || controller.isPurging}
          onClick={() => controller.setRetentionOpen(true)}
        >
          Configure retention
        </Button>
      ) : null}
    </div>
  )
}
