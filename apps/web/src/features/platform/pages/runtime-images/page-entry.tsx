import { Suspense } from 'react'
import { PlatformRouteUnavailable } from '@/shared/ui/page/platform-route-unavailable'
import { PlatformInventoryPageSkeleton } from '../../components/loaders/platform-page-skeletons'
import { RuntimeImagesPageClient } from '../../components/runtime-images-page-client'
import { loadRuntimeImagesPageData, type ImagesSearchParams } from './page-data.server'

const ImagesPageFallback = () => (
  <PlatformInventoryPageSkeleton
    titleWidth='w-36 max-sm:w-28'
    minWidth='72rem'
    columns={[
      { width: '24rem', headerWidth: 'w-16', kind: 'stacked' },
      { width: '9rem', headerWidth: 'w-14', kind: 'text', cellWidth: 'w-20' },
      { width: '9rem', headerWidth: 'w-16', kind: 'text', cellWidth: 'w-24' },
      { width: '8rem', headerWidth: 'w-[4.5rem]', kind: 'text', cellWidth: 'w-12' },
      { width: '14rem', headerWidth: 'w-10', kind: 'text', cellWidth: 'w-28' },
      { width: '10rem', headerWidth: 'w-16', kind: 'actions' }
    ]}
  />
)

const RuntimeImagesPageContent = async ({ searchParams }: { searchParams?: Promise<ImagesSearchParams> }) => {
  const { gridQuery, imagesPage, orchestratorError } = await loadRuntimeImagesPageData(
    (await searchParams) ?? {}
  )

  if (orchestratorError) {
    return (
      <PlatformRouteUnavailable
        title='Images'
        description='Local images available to application containers, custom runtimes, and platform sidecars.'
        detail={orchestratorError}
        href='/runtime/images'
        breadcrumbRoot={{ label: 'Runtime' }}
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
    <Suspense fallback={<ImagesPageFallback />}>
      <RuntimeImagesPageContent searchParams={searchParams} />
    </Suspense>
  )
}
