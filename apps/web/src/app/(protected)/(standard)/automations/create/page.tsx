import { AutomationCreatePageEntry } from '@/features/automations/pages/automation-create/page-entry'
import { requireFeature } from '@/server/orchestrator/features'

export default async function CreateAutomationRoute() {
  await requireFeature('feature.workflows')
  return <AutomationCreatePageEntry />
}
