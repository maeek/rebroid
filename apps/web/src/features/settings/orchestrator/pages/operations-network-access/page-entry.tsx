import { Suspense } from 'react'
import { FirewallSettingsPageClient } from '../../firewall-settings-page-client'
import { OperationalSettingsPageSkeleton } from '../../operational-settings-skeleton'
import { loadOperationsNetworkAccessPageData } from './page-data.server'

const firewallColumns = [
  { width: '14rem', headerWidth: 'w-20', kind: 'text' },
  { width: '8rem', headerWidth: 'w-14', kind: 'text' },
  { width: '10rem', headerWidth: 'w-14', kind: 'badge' },
  { width: '8rem', headerWidth: 'w-14', kind: 'text' },
  { width: '10rem', headerWidth: 'w-14', kind: 'badge' },
  { width: '10rem', headerWidth: 'w-14', kind: 'actions' }
] as const

const OperationsNetworkAccessPageContent = async () => {
  const { applications, firewallHealth } = await loadOperationsNetworkAccessPageData()

  return (
    <FirewallSettingsPageClient
      initialHealth={firewallHealth}
      initialApplications={applications}
    />
  )
}

export function OperationsNetworkAccessPageEntry() {
  return (
    <Suspense
      fallback={
        <OperationalSettingsPageSkeleton
          titleWidth='w-36 max-sm:w-24'
          sectionTitle='Network access policies'
          columns={[...firewallColumns]}
          minWidth='58rem'
          includeOrchestratorBreadcrumb={false}
        />
      }
    >
      <OperationsNetworkAccessPageContent />
    </Suspense>
  )
}
