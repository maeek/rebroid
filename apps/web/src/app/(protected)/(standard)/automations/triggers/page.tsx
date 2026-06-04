import { AutomationTriggersPage } from '@/features/automations/automations-page/automation-triggers-page'
import { listApplicationsAction } from '@/server/orchestrator/applications/actions/queries/listing-actions'
import { listAutomationTriggersAction, listAutomationsAction } from '@/server/orchestrator/automations/actions'

export default async function AutomationTriggersRoute() {
  const [applications, automations, triggers] = await Promise.all([
    listApplicationsAction({ reconcile: false }),
    listAutomationsAction(),
    listAutomationTriggersAction()
  ])

  return (
    <AutomationTriggersPage
      initialApplications={applications}
      initialAutomations={automations}
      initialTriggers={triggers}
    />
  )
}
