import { AutomationsListPageEntry } from '@/features/automations/pages/automations-list/page-entry'
import type { AutomationsSearchParams } from '@/features/automations/pages/automations-list/page-data.server'

export default function AutomationsRoute({ searchParams }: { searchParams?: Promise<AutomationsSearchParams> }) {
  return <AutomationsListPageEntry searchParams={searchParams} />
}
