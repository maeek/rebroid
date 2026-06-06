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

export default async function OrchestratorImagesPage({ searchParams }: { searchParams?: Promise<ImagesSearchParams> }) {
  const gridQuery = imagesGridQueryFromSearchParams((await searchParams) ?? {})
  const imagesPage = await listPlatformImagesGridAction(gridQuery)
  return (
    <OrchestratorImagesPageClient
      imagesPage={imagesPage}
      gridQuery={gridQuery}
    />
  )
}
