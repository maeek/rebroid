import { Suspense } from 'react'
import { OrchestratorPageBoundary } from '@/server/orchestrator/orchestrator-page-boundary'
import { PlatformRouteUnavailable } from '@/shared/ui/page/platform-route-unavailable'
import { CastingSettingsPageClient } from '../../casting-settings-page-client'
import { loadCastingPageData } from './page-data.server'
import { CastingPageLoading } from './page-skeleton'

const CastingPageContent = () => (
  <OrchestratorPageBoundary
    load={loadCastingPageData}
    fallback={requestId => (
      <PlatformRouteUnavailable
        requestId={requestId}
        title='Casting'
        description='Inspect the display service and manage viewer sessions.'
        section={{ label: 'Administration' }}
      />
    )}
  >
    {({ applications, owners, sessions, sidecarHealth, containerId }) => (
      <CastingSettingsPageClient
        initialHealth={sidecarHealth}
        containerId={containerId}
        initialSessions={sessions}
        applications={applications}
        owners={owners}
      />
    )}
  </OrchestratorPageBoundary>
)

export function CastingPageEntry() {
  return (
    <Suspense fallback={<CastingPageLoading />}>
      <CastingPageContent />
    </Suspense>
  )
}
