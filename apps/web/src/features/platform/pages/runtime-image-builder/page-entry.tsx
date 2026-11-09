import { OrchestratorPageBoundary } from '@/server/orchestrator/orchestrator-page-boundary'
import { PlatformRouteUnavailable } from '@/shared/ui/page/platform-route-unavailable'
import { RuntimeGappsImageBuilderPageClient } from './gapps-page-client'
import { loadRuntimeGappsBuilderPageData } from './gapps-page-data.server'

export const RuntimeImageBuilderPageEntry = ({ uploadedApkId }: { uploadedApkId?: string } = {}) => (
  <OrchestratorPageBoundary
    load={loadRuntimeGappsBuilderPageData}
    fallback={requestId => (
      <PlatformRouteUnavailable
        requestId={requestId}
        title='Image builder'
        description='Build a runtime image with Google apps.'
        section={{ label: 'Runtime' }}
      />
    )}
  >
    {data => (
      <RuntimeGappsImageBuilderPageClient
        {...data}
        uploadedApkId={uploadedApkId}
      />
    )}
  </OrchestratorPageBoundary>
)
