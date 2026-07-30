import { Suspense } from 'react'
import { FirewallSettingsPageClient } from '../../firewall-settings-page-client'
import { SecurityNetworkPoliciesPageLoading } from '../../firewall-settings-page-loading'
import { loadSecurityNetworkPoliciesPageData } from './page-data.server'

const SecurityNetworkPoliciesPageContent = async () => {
  const { applications, firewallHealth } = await loadSecurityNetworkPoliciesPageData()

  return (
    <FirewallSettingsPageClient
      initialHealth={firewallHealth}
      initialApplications={applications}
    />
  )
}

export function SecurityNetworkPoliciesPageEntry() {
  return (
    <Suspense fallback={<SecurityNetworkPoliciesPageLoading />}>
      <SecurityNetworkPoliciesPageContent />
    </Suspense>
  )
}
