import { Suspense } from 'react'
import { PlatformRouteUnavailable } from '@/shared/ui/page/platform-route-unavailable'
import { PlatformInventoryPageSkeleton } from '../../components/loaders/orchestrator-page-skeletons'
import { OrchestratorImagesPageClient } from '../../components/orchestrator-images-page-client'
import { loadInfrastructureImagesPageData, type ImagesSearchParams } from './page-data.server'

const ImagesPageFallback = () => (
  <PlatformInventoryPageSkeleton
    titleWidth='w-36 max-sm:w-28'
    sectionTitleWidth='w-20'
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

const InfrastructureImagesPageContent = async ({ searchParams }: { searchParams?: Promise<ImagesSearchParams> }) => {
  const { gridQuery, imagesPage, orchestratorError } = await loadInfrastructureImagesPageData(
    (await searchParams) ?? {}
  )

  if (orchestratorError) {
    return (
      <PlatformRouteUnavailable
        title='Images'
        description='Local images available to application containers, custom runtimes, and platform sidecars.'
        detail={orchestratorError}
        href='/infrastructure/images'
        breadcrumbRoot={{ label: 'Infrastructure' }}
      />
    )
  }

  return (
    <OrchestratorImagesPageClient
      imagesPage={imagesPage}
      gridQuery={gridQuery}
    />
  )
}

export function InfrastructureImagesPageEntry({ searchParams }: { searchParams?: Promise<ImagesSearchParams> }) {
  return (
    <Suspense fallback={<ImagesPageFallback />}>
      <InfrastructureImagesPageContent searchParams={searchParams} />
    </Suspense>
  )
}
