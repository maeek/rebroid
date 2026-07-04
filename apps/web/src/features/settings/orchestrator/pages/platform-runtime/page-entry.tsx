import { Suspense } from 'react'
import { PlatformRuntimeForm } from '../../platform-runtime-form'
import { PlatformRuntimePageSkeleton } from '../../platform-runtime-page-skeleton'
import { getPlatformRuntimePageData } from './page-data.server'

const PlatformRuntimeContent = async () => {
  const { images, initialSettings } = await getPlatformRuntimePageData()

  return (
    <PlatformRuntimeForm
      images={images}
      initialSettings={initialSettings}
    />
  )
}

export default function PlatformRuntimePageEntry() {
  return (
    <Suspense fallback={<PlatformRuntimePageSkeleton />}>
      <PlatformRuntimeContent />
    </Suspense>
  )
}
