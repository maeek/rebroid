import { Suspense } from 'react'
import { FirewallSettingsPageClient } from '@/features/settings/orchestrator/firewall-settings-page-client'
import { OperationalSettingsPageSkeleton } from '@/features/settings/orchestrator/operational-settings-skeleton'
import { requireAdmin } from '@/server/auth/authorization'
import { listApplicationsAction } from '@/server/orchestrator/applications/actions/queries/listing-actions'
import { getOrchestratorHealthAction } from '@/server/orchestrator/diagnostics/actions'

const firewallColumns = [
  { width: '14rem', headerWidth: 'w-20', kind: 'text' },
  { width: '8rem', headerWidth: 'w-14', kind: 'text' },
  { width: '10rem', headerWidth: 'w-14', kind: 'badge' },
  { width: '8rem', headerWidth: 'w-14', kind: 'text' },
  { width: '10rem', headerWidth: 'w-14', kind: 'badge' },
  { width: '10rem', headerWidth: 'w-14', kind: 'actions' }
] as const

const FirewallSettingsContent = async () => {
  const [health, applications] = await Promise.all([getOrchestratorHealthAction(), listApplicationsAction()])

  return (
    <FirewallSettingsPageClient
      initialHealth={health.services.firewall}
      initialApplications={applications}
    />
  )
}

export default async function OrchestratorFirewallSettingsPage() {
  await requireAdmin()

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
      <FirewallSettingsContent />
    </Suspense>
  )
}
