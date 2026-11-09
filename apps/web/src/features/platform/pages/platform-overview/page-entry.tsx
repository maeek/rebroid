import { PlatformOverviewPageClient } from '@/features/platform/components/platform-overview-page-client'
import { OrchestratorPageBoundary } from '@/server/orchestrator/orchestrator-page-boundary'
import { PlatformRouteUnavailable } from '@/shared/ui/page/platform-route-unavailable'

export const PlatformOverviewPageEntry = () => (
  <OrchestratorPageBoundary
    load={() => Promise.resolve(null)}
    fallback={requestId => (
      <PlatformRouteUnavailable
        requestId={requestId}
        title='Overview'
        description='App failures, active operations, and platform capacity.'
        backAction={null}
      />
    )}
  >
    {() => <PlatformOverviewPageClient />}
  </OrchestratorPageBoundary>
)
