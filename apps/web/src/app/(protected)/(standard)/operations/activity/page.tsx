import { OperationsActivityPageEntry } from '@/features/settings/activity/pages/operations-activity/page-entry'
import type { AuditSearchParams } from '@/features/settings/activity/pages/operations-activity/page-data.server'

export default function ActivitySettingsPage({ searchParams }: { searchParams?: Promise<AuditSearchParams> }) {
  return <OperationsActivityPageEntry searchParams={searchParams} />
}
