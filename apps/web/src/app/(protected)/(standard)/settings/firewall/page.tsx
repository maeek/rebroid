import { Suspense } from 'react'
import { PlatformPageHeader } from '@/features/orchestrator/components/platform-page-header'
import { FirewallSettings } from '@/features/settings/orchestrator/firewall-settings'
import { OperationalSettingsSkeleton } from '@/features/settings/orchestrator/operational-settings-skeleton'
import { ProtectedStackPageLayout } from '@/features/shell/components/protected-page-shell'
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
    <FirewallSettings
      initialHealth={health.services.firewall}
      initialApplications={applications}
    />
  )
}

export default async function OrchestratorFirewallSettingsPage() {
  await requireAdmin()

  return (
    <ProtectedStackPageLayout mainClassName='gap-2'>
      <PlatformPageHeader
        title='Network access'
        description='Apply outbound network restrictions to application containers.'
        includeOrchestratorBreadcrumb={false}
      />
      <section className='flex w-full flex-col gap-6 px-6 pb-16 max-sm:px-4'>
        <Suspense
          fallback={
            <OperationalSettingsSkeleton
              title='Firewall agent'
              columns={[...firewallColumns]}
              minWidth='58rem'
            />
          }
        >
          <FirewallSettingsContent />
        </Suspense>
      </section>
    </ProtectedStackPageLayout>
  )
}
