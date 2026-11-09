import { Suspense } from 'react'
import { PlatformRuntimePageSkeleton } from '../../platform-runtime-page-skeleton'
import { PlatformRuntimePageClient } from './page-client'
import { getPlatformRuntimePageData } from './page-data.server'

const PlatformRuntimeContent = async () => {
  const data = await getPlatformRuntimePageData()
  return <PlatformRuntimePageClient data={data} />
}

export default function PlatformRuntimePageEntry() {
  return (
    <Suspense fallback={<PlatformRuntimePageSkeleton />}>
      <PlatformRuntimeContent />
    </Suspense>
  )
}
