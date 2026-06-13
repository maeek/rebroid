import { listPlatformImagesGridAction } from '@/server/orchestrator/platform/image-actions'
import { platformGridQueryFromSearchParams, type PlatformGridSearchParams } from '../platform-grid-search'
import type { PlatformImagesGridPage, PlatformImagesGridQuery } from '@/server/orchestrator/platform/types'

export type ImagesSearchParams = PlatformGridSearchParams

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'The orchestrator API is not responding.'

const emptyImagesPage = (gridQuery: PlatformImagesGridQuery): PlatformImagesGridPage => ({
  items: [],
  total: 0,
  page: gridQuery.page ?? 1,
  pageSize: gridQuery.pageSize ?? 20
})

export const imagesGridQueryFromSearchParams = (searchParams: ImagesSearchParams): PlatformImagesGridQuery =>
  platformGridQueryFromSearchParams(searchParams)

export const loadInfrastructureImagesPageData = async (searchParams: ImagesSearchParams) => {
  const gridQuery = imagesGridQueryFromSearchParams(searchParams)
  let orchestratorError: string | null = null
  const imagesPage = await listPlatformImagesGridAction(gridQuery).catch(error => {
    orchestratorError = errorMessage(error)
    return emptyImagesPage(gridQuery)
  })

  return {
    gridQuery,
    imagesPage,
    orchestratorError
  }
}
