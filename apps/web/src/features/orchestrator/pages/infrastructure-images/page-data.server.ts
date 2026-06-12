import { listPlatformImagesGridAction } from '@/server/orchestrator/platform/image-actions'
import { platformGridQueryFromSearchParams, type PlatformGridSearchParams } from '../platform-grid-search'
import type { PlatformImagesGridQuery } from '@/server/orchestrator/platform/types'

export type ImagesSearchParams = PlatformGridSearchParams

export const imagesGridQueryFromSearchParams = (searchParams: ImagesSearchParams): PlatformImagesGridQuery =>
  platformGridQueryFromSearchParams(searchParams)

export const loadInfrastructureImagesPageData = async (searchParams: ImagesSearchParams) => {
  const gridQuery = imagesGridQueryFromSearchParams(searchParams)
  const imagesPage = await listPlatformImagesGridAction(gridQuery)

  return {
    gridQuery,
    imagesPage
  }
}
