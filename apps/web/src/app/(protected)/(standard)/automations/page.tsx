import { AutomationsListPageEntry } from '@/features/automations/pages/automations-list/page-entry'
import { requireFeature } from '@/server/orchestrator/features'
import type { WorkflowGridSearchParams } from '@/features/automations/pages/workflow-grid-query'

export default async function AutomationsRoute({ searchParams }: { searchParams?: Promise<WorkflowGridSearchParams> }) {
  await requireFeature('feature.workflows')
  return <AutomationsListPageEntry searchParams={searchParams} />
}
