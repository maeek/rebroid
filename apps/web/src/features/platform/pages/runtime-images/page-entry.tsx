import { Suspense } from 'react'
import { PlatformRouteUnavailable } from '@/shared/ui/page/platform-route-unavailable'
import { RuntimeImagesPageClient, RuntimeImagesPageLoading } from '../../components/runtime-images-page-client'
import { loadRuntimeImagesPageData, type ImagesSearchParams } from './page-data.server'

const RuntimeImagesPageContent = async ({ searchParams }: { searchParams?: Promise<ImagesSearchParams> }) => {
  const { gridQuery, imagesPage, orchestratorError } = await loadRuntimeImagesPageData((await searchParams) ?? {})

  if (orchestratorError) {
    return (
      <PlatformRouteUnavailable
        title='Images'
        description='Local images available to application containers, custom runtimes, and platform sidecars.'
        href='/runtime/images'
        section={{ label: 'Runtime' }}
      />
    )
  }

  return (
    <RuntimeImagesPageClient
      imagesPage={imagesPage}
      gridQuery={gridQuery}
    />
  )
}

export function RuntimeImagesPageEntry({ searchParams }: { searchParams?: Promise<ImagesSearchParams> }) {
  return (
    <Suspense fallback={<RuntimeImagesPageLoading />}>
      <RuntimeImagesPageContent searchParams={searchParams} />
    </Suspense>
  )
}
