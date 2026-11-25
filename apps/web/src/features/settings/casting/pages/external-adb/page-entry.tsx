import { Suspense } from 'react'
import { OrchestratorPageBoundary } from '@/server/orchestrator/orchestrator-page-boundary'
import { PlatformRouteUnavailable } from '@/shared/ui/page/platform-route-unavailable'
import { ExternalAdbPageClient, ExternalAdbPageLoading } from './page-client'
import { loadExternalAdbPageData } from './page-data.server'

export const ExternalAdbPageEntry = () => (
  <Suspense fallback={<ExternalAdbPageLoading />}>
    <OrchestratorPageBoundary
      load={loadExternalAdbPageData}
      fallback={requestId => (
        <PlatformRouteUnavailable
          requestId={requestId}
          title='External ADB'
          description='Manage the external device broker and allowed TCP endpoints.'
          section={{ label: 'Administration' }}
        />
      )}
    >
      {data => <ExternalAdbPageClient {...data} />}
    </OrchestratorPageBoundary>
  </Suspense>
)
