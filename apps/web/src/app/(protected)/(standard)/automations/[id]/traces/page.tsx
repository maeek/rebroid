import { AutomationTracesPageEntry } from '@/features/automations/pages/automation-traces/page-entry'

export default function AutomationTracesRoute({ params }: { params: Promise<{ id: string }> }) {
  return <AutomationTracesPageEntry params={params} />
}
