import { listApplicationsAction } from '@/server/orchestrator/applications/actions/queries/listing-actions'
import { getRequiredServerOrchestratorUiSettings } from '@/server/orchestrator/get-server-ui-settings'
import { readOrchestratorPage } from '@/server/orchestrator/orchestrator-page-read'
import { loadServiceContainerIds } from '@/server/orchestrator/platform/service-containers'
import { orchestratorSettingsClient } from '@/server/orchestrator/settings/client'
import type { OrchestratorHealth } from '@/shared/contracts/diagnostics'

const loadFirewallPolicies = async () => {
  const manifest = await orchestratorSettingsClient.getFeatures()
  const enabled = manifest.features.some(
    feature => feature.key === 'feature.firewall' && feature.enabled && feature.supported
  )
  return enabled ? listApplicationsAction() : undefined
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
