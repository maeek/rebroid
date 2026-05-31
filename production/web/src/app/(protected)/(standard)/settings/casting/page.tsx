import { Suspense } from 'react'
import { PlatformPageHeader } from '@/features/orchestrator/components/platform-page-header'
import { CastingSidecarSettings } from '@/features/settings/casting/casting-sidecar-settings'
import { OperationalSettingsSkeleton } from '@/features/settings/orchestrator/operational-settings-skeleton'
import { ProtectedStackPageLayout } from '@/features/shell/components/protected-page-shell'
import { requireAdmin } from '@/server/auth/authorization'
import {
  getOrchestratorHealthAction,
  listDisplaySidecarSessionsAction
} from '@/server/orchestrator/diagnostics/actions'

const castingColumns = [
  { width: '12rem', headerWidth: 'w-20', kind: 'text' },
  { width: '12rem', headerWidth: 'w-14', kind: 'text' },
  { width: '8rem', headerWidth: 'w-14', kind: 'badge' },
  { width: '14rem', headerWidth: 'w-24', kind: 'text' },
  { width: '14rem', headerWidth: 'w-14', kind: 'text' },
  { width: '9rem', headerWidth: 'w-14', kind: 'actions' }
] as const

const CastingSettingsContent = async () => {
  const health = await getOrchestratorHealthAction()
  const sessions = health.services.display.ok ? await listDisplaySidecarSessionsAction().catch(() => []) : []

  return (
    <CastingSidecarSettings
      initialHealth={health.services.display}
      initialSessions={sessions}
    />
  )
}

export default async function CastingSettingsPage() {
  await requireAdmin()

  return (
    <ProtectedStackPageLayout mainClassName='gap-2'>
      <PlatformPageHeader
        title='Casting'
        description='Inspect the casting sidecar and terminate active viewer sessions.'
        includeOrchestratorBreadcrumb={false}
      />
      <section className='flex w-full flex-col gap-6 px-6 pb-16 max-sm:px-4'>
        <Suspense
          fallback={
            <OperationalSettingsSkeleton
              title='Casting sidecar'
              columns={[...castingColumns]}
              minWidth='52rem'
            />
          }
        >
          <CastingSettingsContent />
        </Suspense>
      </section>
    </ProtectedStackPageLayout>
  )
}
