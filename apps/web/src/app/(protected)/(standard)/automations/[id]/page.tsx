import { AutomationEditPageEntry } from '@/features/automations/pages/automation-edit/page-entry'

export default function EditAutomationRoute({ params }: { params: Promise<{ id: string }> }) {
  return <AutomationEditPageEntry params={params} />
}
