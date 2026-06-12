import { AutomationTriggersPageEntry } from '@/features/automations/pages/automation-triggers/page-entry'
import type { AutomationTriggersSearchParams } from '@/features/automations/pages/automation-triggers/page-data.server'

export default function AutomationTriggersRoute({
  searchParams
}: {
  searchParams?: Promise<AutomationTriggersSearchParams>
}) {
  return <AutomationTriggersPageEntry searchParams={searchParams} />
}
