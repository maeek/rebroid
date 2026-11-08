import { AutomationTracesPageEntry } from '@/features/automations/pages/automation-traces/page-entry'

export default function AutomationTracesRoute({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ run?: string }>
}) {
  return (
    <AutomationTracesPageEntry
      params={params}
      searchParams={searchParams}
    />
  )
}
