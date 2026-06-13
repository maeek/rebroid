import { QuickGlanceCard } from '@/shared/ui/settings/quick-glance-card'
import { useActivityData } from '../activity-context'
import { metricNumber, relativeTime } from '../activity-format'

export const ActivitySummaryCards = () => {
  const { result, auditRetentionDays } = useActivityData()

  return (
    <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-4'>
      <QuickGlanceCard
        label='Events'
        value={metricNumber(result.total)}
        hint='Current filtered view'
      />
      <QuickGlanceCard
        label='Failures'
        value={metricNumber(result.summary.failure)}
        hint={`${metricNumber(result.summary.success)} successful`}
        className='border-l-destructive'
      />
      <QuickGlanceCard
        label='Last event'
        value={relativeTime(result.summary.lastEventAt)}
        hint={result.summary.lastEventAt ? new Date(result.summary.lastEventAt).toLocaleString() : 'No timestamp'}
        className='border-l-surface-border'
      />
      <QuickGlanceCard
        label='Retention'
        value={`${auditRetentionDays} days`}
        hint='Automatic cleanup window'
        className='border-l-surface-border'
      />
    </div>
  )
}
