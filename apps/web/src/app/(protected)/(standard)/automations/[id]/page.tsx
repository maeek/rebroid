import { AutomationEditPageEntry } from '@/features/automations/pages/automation-edit/page-entry'
import { requireFeature } from '@/server/orchestrator/features'

export default async function EditAutomationRoute({ params }: { params: Promise<{ id: string }> }) {
  await requireFeature('feature.workflows')
  return <AutomationEditPageEntry params={params} />
}
