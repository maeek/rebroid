import { AutomationEditorPageEntry } from '@/features/automations/pages/automation-editor/page-entry'
import { requireFeature } from '@/server/orchestrator/features'

export default async function EditAutomationRoute({ params }: { params: Promise<{ id: string }> }) {
  await requireFeature('feature.workflows')
  return <AutomationEditorPageEntry params={params} />
}
