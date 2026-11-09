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
        title='Network policies'
        description='Apply outbound network restrictions to application containers.'
        section={{ label: 'Security' }}
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
