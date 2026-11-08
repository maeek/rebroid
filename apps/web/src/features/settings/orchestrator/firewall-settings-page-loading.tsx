'use client'

import { FirewallSettingsPageClient } from './firewall-settings-page-client'

export const SecurityNetworkPoliciesPageLoading = () => (
  <FirewallSettingsPageClient
    loading
    initialApplications={[]}
    initialHealth={{ status: 'offline', ok: false, message: '' }}
  />
)
