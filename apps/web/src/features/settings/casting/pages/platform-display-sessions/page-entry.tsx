import { Suspense } from 'react'
import { OrchestratorPageBoundary } from '@/server/orchestrator/orchestrator-page-boundary'
import { PlatformRouteUnavailable } from '@/shared/ui/page/platform-route-unavailable'
import { CastingSettingsPageClient } from '../../casting-settings-page-client'
import { loadPlatformDisplaySessionsPageData } from './page-data.server'
import { PlatformDisplaySessionsPageSkeleton } from './page-skeleton'

const PlatformDisplaySessionsPageContent = () => (
  <OrchestratorPageBoundary
    load={loadPlatformDisplaySessionsPageData}
    fallback={requestId => (
      <PlatformRouteUnavailable
        requestId={requestId}
        title='Display sessions'
        description='Inspect the display service and end active viewer sessions.'
        section={{ label: 'Platform', href: '/platform' }}
        trail={[{ label: 'Services', href: '/platform/services' }]}
      />
    )}
  >
    {({ applications, owners, sessions, sidecarHealth }) => (
      <CastingSettingsPageClient
        initialHealth={sidecarHealth}
        initialSessions={sessions}
        applications={applications}
        owners={owners}
      />
    )}
  </OrchestratorPageBoundary>
)

export function PlatformDisplaySessionsPageEntry() {
  return (
    <Suspense fallback={<PlatformDisplaySessionsPageSkeleton />}>
      <PlatformDisplaySessionsPageContent />
    </Suspense>
  )
}
