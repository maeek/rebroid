import { imageDisplayName } from '@/features/orchestrator/domain/image-display-name'
import { buildPlatformGridHref } from './orchestrator-grid-query-utils'
import type { PlatformImage, PlatformImagesGridQuery } from '@/server/orchestrator/platform/types'

type ImagesGridHrefInput = {
  gridQuery: PlatformImagesGridQuery
  pageSize: number
  patch: Partial<PlatformImagesGridQuery>
}

const byteUnits = ['B', 'KB', 'MB', 'GB', 'TB'] as const

export const buildImagesGridHref = ({ gridQuery, pageSize, patch }: ImagesGridHrefInput) =>
  buildPlatformGridHref({
    basePath: '/infrastructure/images',
    gridQuery,
    pageSize,
    patch
  })

export const canRemoveSelectedImages = (images: PlatformImage[]) => images.length > 0

export const formatImageSize = (bytes: number) => {
  if (!bytes) {
    return '0 B'
  }

  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), byteUnits.length - 1)
  return `${(bytes / 1024 ** index).toFixed(2)} ${byteUnits[index]}`
}

export const getImageSecondaryLabel = (image: PlatformImage) =>
  image.repoTags.length > 1 ? image.repoTags.slice(1).join(', ') : (image.repoDigests[0] ?? image.shortId)

export const formatImageContainerCount = (containers: number) => (containers < 0 ? 'unknown' : String(containers))

export const getImageRemoveDialogLabel = (image: PlatformImage | null) =>
  image ? imageDisplayName(image) : 'the selected image'
