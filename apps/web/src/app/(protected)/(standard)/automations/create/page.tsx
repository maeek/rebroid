import { AutomationEditorPageEntry } from '@/features/automations/pages/automation-editor/page-entry'
import { requireFeature } from '@/server/orchestrator/features'

export default async function CreateAutomationRoute() {
  await requireFeature('feature.workflows')
  return <AutomationEditorPageEntry />
}
