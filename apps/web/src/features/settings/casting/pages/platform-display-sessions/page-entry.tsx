import { Suspense } from 'react'
import { OperationalSettingsPageSkeleton } from '@/features/settings/orchestrator/operational-settings-skeleton'
import { CastingSettingsPageClient } from '../../casting-settings-page-client'
import { loadPlatformDisplaySessionsPageData } from './page-data.server'

const castingColumns = [
  { width: '12rem', headerWidth: 'w-20', kind: 'text' },
  { width: '12rem', headerWidth: 'w-14', kind: 'text' },
  { width: '8rem', headerWidth: 'w-14', kind: 'badge' },
  { width: '14rem', headerWidth: 'w-24', kind: 'text' },
  { width: '14rem', headerWidth: 'w-14', kind: 'text' },
  { width: '9rem', headerWidth: 'w-14', kind: 'actions' }
] as const

const PlatformDisplaySessionsPageContent = async () => {
  const { applications, owners, sessions, sidecarHealth } = await loadPlatformDisplaySessionsPageData()

  return (
    <CastingSettingsPageClient
      initialHealth={sidecarHealth}
      initialSessions={sessions}
      applications={applications}
      owners={owners}
    />
  )
}

export function PlatformDisplaySessionsPageEntry() {
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
      <PlatformDisplaySessionsPageContent />
    </Suspense>
  )
}
