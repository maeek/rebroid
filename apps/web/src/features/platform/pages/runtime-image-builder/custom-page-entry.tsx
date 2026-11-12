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
        title='Build custom image'
        description='Build a runtime image from a Dockerfile and uploaded context.'
        section={{ label: 'Docker' }}
        trail={[{ label: 'Images', href: '/runtime/images' }]}
      />
    )}
  >
    {data => <RuntimeImageBuilderPageClient {...data} />}
  </OrchestratorPageBoundary>
)
