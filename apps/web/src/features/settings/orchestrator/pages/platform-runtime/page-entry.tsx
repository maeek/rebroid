import { Suspense } from 'react'
import { PlatformRuntimePageSkeleton } from '../../platform-runtime-page-skeleton'
import { PlatformRuntimeForm } from '../../platform-runtime-form'
import { getPlatformRuntimePageData } from './page-data.server'

const PlatformRuntimeContent = async () => {
  const { initialSettings } = await getPlatformRuntimePageData()

  return <PlatformRuntimeForm initialSettings={initialSettings} />
}

export default function PlatformRuntimePageEntry() {
  return (
    <Suspense fallback={<PlatformRuntimePageSkeleton />}>
      <PlatformRuntimeContent />
    </Suspense>
  )
}
