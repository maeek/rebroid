import { listPlatformImagesGridAction } from '@/server/orchestrator/platform/image-actions'
import { platformGridQueryFromSearchParams, type PlatformGridSearchParams } from '../platform-grid-search'
import type { PlatformImagesGridQuery } from '@/shared/contracts/platform'

export type ImagesSearchParams = PlatformGridSearchParams

export const imagesGridQueryFromSearchParams = (searchParams: ImagesSearchParams): PlatformImagesGridQuery =>
  platformGridQueryFromSearchParams(searchParams)

export const loadRuntimeImagesPageData = async (searchParams: ImagesSearchParams) => {
  const gridQuery = imagesGridQueryFromSearchParams(searchParams)
  return { gridQuery, imagesPage: await listPlatformImagesGridAction(gridQuery) }
}
