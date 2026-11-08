import { ApplicationViewerPageEntry } from '@/features/applications/pages/application-viewer/page-entry'
import { ActivityEventsTable } from '@/features/settings/activity/activity-events-table'
import { AppActivityLoading } from '@/features/settings/activity/activity-page-skeleton'
import type { AuditSearchParams } from '@/shared/contracts/audit'

export default function Page(props: { params: Promise<{ slug: string }>; searchParams: Promise<AuditSearchParams> }) {
  return (
    <ApplicationViewerPageEntry
      {...props}
      loadingActivity={<AppActivityLoading />}
      renderActivity={activity => <ActivityEventsTable {...activity} />}
    />
  )
}
