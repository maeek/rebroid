import { AutomationTriggersPageEntry } from '@/features/automations/pages/automation-triggers/page-entry'
import { requireFeature } from '@/server/orchestrator/features'
import type { WorkflowGridSearchParams } from '@/features/automations/pages/workflow-grid-query'

export default async function AutomationTriggersRoute({
  searchParams
}: {
  searchParams?: Promise<WorkflowGridSearchParams>
}) {
  await requireFeature('feature.workflows')
  return <AutomationTriggersPageEntry searchParams={searchParams} />
}
