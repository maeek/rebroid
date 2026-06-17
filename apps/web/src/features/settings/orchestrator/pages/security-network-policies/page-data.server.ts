import { requireAdmin } from '@/server/auth/authorization'
import { listApplicationsAction } from '@/server/orchestrator/applications/actions/queries/listing-actions'
import { getOrchestratorHealthAction } from '@/server/orchestrator/diagnostics/actions'

export const loadSecurityNetworkPoliciesPageData = async () => {
  await requireAdmin()

  const [health, applications] = await Promise.all([getOrchestratorHealthAction(), listApplicationsAction()])

  return {
    applications,
    firewallHealth: health.services.firewall
  }
}
