import { requireAdmin } from '@/server/auth/authorization'
import { listApplicationsAction } from '@/server/orchestrator/applications/actions/queries/listing-actions'
import { getOrchestratorHealthAction } from '@/server/orchestrator/diagnostics/actions'
import { requireFeature } from '@/server/orchestrator/features'
import type { OrchestratorHealth } from '@/shared/contracts/diagnostics'

export const loadSecurityNetworkPoliciesPageData = async (initialHealth?: OrchestratorHealth) => {
  await requireAdmin()
  await requireFeature('feature.firewall')

  const health = initialHealth ?? (await getOrchestratorHealthAction())
  const applications = await listApplicationsAction()

  return {
    applications,
    firewallHealth: health.services.firewall
  }
}
