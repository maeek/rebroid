import { OrchestratorPageBoundary } from '@/server/orchestrator/orchestrator-page-boundary'
import { PlatformRouteUnavailable } from '@/shared/ui/page/platform-route-unavailable'
import { RuntimeImageBuilderPageClient } from './page-client'
import { loadRuntimeImageBuilderPageData } from './page-data.server'

export const CustomRuntimeImageBuilderPageEntry = () => (
  <OrchestratorPageBoundary
    load={loadRuntimeImageBuilderPageData}
    fallback={requestId => (
      <PlatformRouteUnavailable
        requestId={requestId}
        title='Custom image builder'
        description='Build a runtime image from a Dockerfile and uploaded context.'
        section={{ label: 'Runtime' }}
      />
    )}
  >
    {data => <RuntimeImageBuilderPageClient {...data} />}
  </OrchestratorPageBoundary>
)
