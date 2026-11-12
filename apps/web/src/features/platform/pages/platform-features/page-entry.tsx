import { Suspense } from 'react'
import { FeaturesPage, FeaturesPageLoading } from '@/features/platform/features/features-page'
import { OrchestratorPageBoundary } from '@/server/orchestrator/orchestrator-page-boundary'
import { PlatformRouteUnavailable } from '@/shared/ui/page/platform-route-unavailable'
import { loadPlatformFeatures } from './page-data.server'

const PlatformFeaturesContent = () => (
  <OrchestratorPageBoundary
    load={loadPlatformFeatures}
    fallback={requestId => (
      <PlatformRouteUnavailable
        requestId={requestId}
        title='Feature management'
        description='Manage platform capabilities and their availability.'
        section={{ label: 'Administration' }}
      />
    )}
  >
    {manifest => <FeaturesPage initialManifest={manifest} />}
  </OrchestratorPageBoundary>
)

export default function PlatformFeaturesPageEntry() {
  return (
    <Suspense fallback={<FeaturesPageLoading />}>
      <PlatformFeaturesContent />
    </Suspense>
  )
}
