import { AutomationTriggersPageEntry } from '@/features/automations/pages/automation-triggers/page-entry'
import { requireFeature } from '@/server/orchestrator/features'
import type { AutomationTriggersSearchParams } from '@/features/automations/pages/automation-triggers/page-data.server'

export default async function AutomationTriggersRoute({
  searchParams
}: {
  searchParams?: Promise<AutomationTriggersSearchParams>
}) {
  await requireFeature('feature.workflows')
  return <AutomationTriggersPageEntry searchParams={searchParams} />
}
