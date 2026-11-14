import { AutomationsListPageEntry } from '@/features/automations/pages/automations-list/page-entry'
import { requireFeature } from '@/server/orchestrator/features'
import type { AutomationsSearchParams } from '@/features/automations/pages/automations-list/page-data.server'

export default async function AutomationsRoute({ searchParams }: { searchParams?: Promise<AutomationsSearchParams> }) {
  await requireFeature('feature.workflows')
  return <AutomationsListPageEntry searchParams={searchParams} />
}
