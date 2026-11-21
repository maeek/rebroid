import { listPlatformImagesGridAction } from '@/server/orchestrator/platform/image-actions'
import { platformGridQueryFromSearchParams, type PlatformGridSearchParams } from '../platform-grid-search'

export const loadRuntimeImagesPageData = async (searchParams: PlatformGridSearchParams) => {
  const gridQuery = platformGridQueryFromSearchParams(searchParams)
  return { gridQuery, imagesPage: await listPlatformImagesGridAction(gridQuery) }
}
