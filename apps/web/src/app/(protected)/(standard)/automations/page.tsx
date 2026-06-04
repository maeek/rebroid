import { AutomationsListPage } from '@/features/automations/automations-page/automations-list-page'
import { listApplicationsAction } from '@/server/orchestrator/applications/actions/queries/listing-actions'
import { listAutomationsAction } from '@/server/orchestrator/automations/actions'

export default async function AutomationsRoute() {
  const [automations, applications] = await Promise.all([
    listAutomationsAction(),
    listApplicationsAction({ reconcile: false })
  ])

  return (
    <AutomationsListPage
      initialApplications={applications}
      initialAutomations={automations}
    />
  )
}
