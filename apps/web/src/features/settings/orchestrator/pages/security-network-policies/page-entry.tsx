import { Suspense } from 'react'
import { OrchestratorPageBoundary } from '@/server/orchestrator/orchestrator-page-boundary'
import { PlatformRouteUnavailable } from '@/shared/ui/page/platform-route-unavailable'
import { FirewallSettingsPageClient } from '../../firewall-settings-page-client'
import { SecurityNetworkPoliciesPageLoading } from '../../firewall-settings-page-loading'
import { loadSecurityNetworkPoliciesPageData } from './page-data.server'

const SecurityNetworkPoliciesPageContent = () => (
  <OrchestratorPageBoundary
    load={loadSecurityNetworkPoliciesPageData}
    fallback={requestId => (
      <PlatformRouteUnavailable
        requestId={requestId}
        title='App network policies'
        description='Monitor outbound access and firewall enforcement. Open an app to edit its policy.'
        section={{ label: 'Administration' }}
      />
    )}
  >
    {({ applications, firewallHealth }) => (
      <FirewallSettingsPageClient
        initialHealth={firewallHealth}
        initialApplications={applications}
      />
    )}
  </OrchestratorPageBoundary>
)

export function SecurityNetworkPoliciesPageEntry() {
  return (
    <Suspense fallback={<SecurityNetworkPoliciesPageLoading />}>
      <SecurityNetworkPoliciesPageContent />
    </Suspense>
  )
}
