import { userService } from '@/server/auth/user'
import { listApplicationsAction } from '@/server/orchestrator/applications/actions/queries/listing-actions'
import { getRequiredServerOrchestratorUiSettings } from '@/server/orchestrator/get-server-ui-settings'
import { readOrchestratorPage } from '@/server/orchestrator/orchestrator-page-read'
import { loadServiceContainerIds } from '@/server/orchestrator/platform/service-containers'
import { orchestratorSettingsClient } from '@/server/orchestrator/settings/client'
import type { FirewallPolicyApplication } from '@/shared/contracts/application'
import type { OrchestratorHealth } from '@/shared/contracts/diagnostics'

const loadFirewallPolicies = async (): Promise<FirewallPolicyApplication[] | undefined> => {
  const manifest = await orchestratorSettingsClient.getFeatures()
  const enabled = manifest.features.some(
    feature => feature.key === 'feature.firewall' && feature.enabled && feature.supported
  )
  if (!enabled) return undefined

  const [applications, users] = await Promise.all([listApplicationsAction(), userService.listUsers()])
  const usernames = new Map(users.map(user => [user.id, user.username]))

  return applications.map(application => ({
    ...application,
    ownerUsername: application.ownerUserId ? usernames.get(application.ownerUserId) : undefined
  }))
}

export const loadFirewallPageData = async (health: OrchestratorHealth) => {
  const [settings, policies] = await Promise.all([
    readOrchestratorPage(getRequiredServerOrchestratorUiSettings),
    readOrchestratorPage(loadFirewallPolicies)
  ])
  const initialSettings = settings.ok ? settings.data.services.firewall : undefined
  const containers = initialSettings
    ? await loadServiceContainerIds(health, { settings: { firewall: initialSettings } })
    : {}

  return {
    initialHealth: health.services.firewall,
    initialSettings,
    containerId: containers.firewall,
    initialApplications: policies.ok ? policies.data : undefined,
    requestId: settings.ok ? undefined : settings.failure.requestId,
    policyFailure: policies.ok ? undefined : { requestId: policies.failure.requestId }
  }
}
