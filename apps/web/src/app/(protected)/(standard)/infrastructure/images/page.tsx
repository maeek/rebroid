import { Suspense } from 'react'
import { PlatformInventoryPageSkeleton } from '@/features/orchestrator/components/loaders/orchestrator-page-skeletons'
import { OrchestratorImagesPageClient } from '@/features/orchestrator/components/orchestrator-images-page-client'
import { listPlatformImagesGridAction } from '@/server/orchestrator/platform/image-actions'
import type { PlatformImagesGridQuery } from '@/server/orchestrator/platform/types'

type ImagesSearchParams = Record<string, string | string[] | undefined>

const firstValue = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)

const imagesGridQueryFromSearchParams = (searchParams: ImagesSearchParams): PlatformImagesGridQuery => {
  const scope = firstValue(searchParams.scope)
  return {
    page: Math.max(Number(firstValue(searchParams.page)) || 1, 1),
    pageSize: Math.min(Math.max(Number(firstValue(searchParams.pageSize)) || 20, 1), 100),
    q: firstValue(searchParams.q)?.trim() || undefined,
    scope: scope === 'all' ? 'all' : 'managed',
    sort: firstValue(searchParams.sort)?.trim() || undefined
  }
}

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

const OrchestratorImagesPageContent = async ({ searchParams }: { searchParams?: Promise<ImagesSearchParams> }) => {
  const gridQuery = imagesGridQueryFromSearchParams((await searchParams) ?? {})
  const imagesPage = await listPlatformImagesGridAction(gridQuery)
  return (
    <OrchestratorImagesPageClient
      imagesPage={imagesPage}
      gridQuery={gridQuery}
    />
  )
}

export default function OrchestratorImagesPage({ searchParams }: { searchParams?: Promise<ImagesSearchParams> }) {
  return (
    <Suspense fallback={<ImagesPageFallback />}>
      <OrchestratorImagesPageContent searchParams={searchParams} />
    </Suspense>
  )
}
