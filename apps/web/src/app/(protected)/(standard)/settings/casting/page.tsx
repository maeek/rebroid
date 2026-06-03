import { Suspense } from 'react'
import { CastingSettingsPageClient } from '@/features/settings/casting/casting-settings-page-client'
import { OperationalSettingsPageSkeleton } from '@/features/settings/orchestrator/operational-settings-skeleton'
import { requireAdmin } from '@/server/auth/authorization'
import { userService } from '@/server/auth/user'
import { listApplicationsAction } from '@/server/orchestrator/applications/actions/queries/listing-actions'
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
  const [health, applications, users] = await Promise.all([
    getOrchestratorHealthAction(),
    listApplicationsAction(),
    userService.listUsers()
  ])
  const sessions = health.services.display.ok ? await listDisplaySidecarSessionsAction().catch(() => []) : []

  return (
    <CastingSettingsPageClient
      initialHealth={health.services.display}
      initialSessions={sessions}
      applications={applications}
      owners={users.map(user => ({ id: user.id, name: user.name || user.username }))}
    />
  )
}

export default async function CastingSettingsPage() {
  await requireAdmin()

  return (
    <Suspense
      fallback={
        <OperationalSettingsPageSkeleton
          titleWidth='w-36 max-sm:w-24'
          sectionTitle='Sessions'
          columns={[...castingColumns]}
          minWidth='52rem'
          includeOrchestratorBreadcrumb={false}
        />
      }
    >
      <CastingSettingsContent />
    </Suspense>
  )
}
