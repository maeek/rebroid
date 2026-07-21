import { SecurityNetworkPoliciesPageEntry } from '@/features/settings/orchestrator/pages/security-network-policies/page-entry'
import { requireFeature } from '@/server/orchestrator/features'

export default async function SecurityNetworkPoliciesPage() {
  await requireFeature('feature.firewall')
  return <SecurityNetworkPoliciesPageEntry />
}
