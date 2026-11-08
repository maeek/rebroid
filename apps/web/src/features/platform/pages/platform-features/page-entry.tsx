import { Suspense } from 'react'
import { FeaturesPage, FeaturesPageLoading } from '@/features/platform/features/features-page'
import { loadPlatformFeatures } from './page-data.server'

const PlatformFeaturesContent = async () => {
  return <FeaturesPage initialManifest={await loadPlatformFeatures()} />
}

export default function PlatformFeaturesPageEntry() {
  return (
    <Suspense fallback={<FeaturesPageLoading />}>
      <PlatformFeaturesContent />
    </Suspense>
  )
}
