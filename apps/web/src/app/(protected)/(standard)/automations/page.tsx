import { AutomationsListPage } from '@/features/automations/automations-page/list/automations-list-page'
import { listApplicationsAction } from '@/server/orchestrator/applications/actions/queries/listing-actions'
import { listAutomationTriggersAction, listAutomationsAction } from '@/server/orchestrator/automations/actions'

export default async function AutomationsRoute() {
  const [automations, applications, triggers] = await Promise.all([
    listAutomationsAction(),
    listApplicationsAction({ reconcile: false }),
    listAutomationTriggersAction()
  ])

  return (
    <AutomationsListPage
      initialApplications={applications}
      initialAutomations={automations}
      initialTriggers={triggers}
    />
  )
}
