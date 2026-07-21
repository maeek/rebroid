import { resolveRuntimeImageMetadata, type RuntimeImageKind } from '@rebroid/android-application-core/redroid-runtime'
import { imageDisplayName } from './image-display-name'
import type { PlatformImage } from '@/shared/contracts/platform'

export const findPlatformImageByReference = (images: PlatformImage[], reference: string) => {
  const normalized = reference.trim()
  if (!normalized) return null

  return (
    images.find(
      image =>
        image.id === normalized ||
        image.shortId === normalized ||
        image.repoTags.includes(normalized) ||
        image.repoDigests.includes(normalized)
    ) ?? null
  )
}

export const resolvePlatformImageRuntimeMetadata = (image: PlatformImage) =>
  resolveRuntimeImageMetadata({
    image: imageDisplayName(image),
    labels: image.labels,
    metadata: image.runtimeMetadata ?? null
  })

export const runtimeKindForImageReference = (
  images: PlatformImage[],
  reference: string,
  fallback: RuntimeImageKind = 'generic'
): RuntimeImageKind => {
  const image = findPlatformImageByReference(images, reference)
  if (image) {
    return resolvePlatformImageRuntimeMetadata(image).metadata.runtimeKind
  }

  return resolveRuntimeImageMetadata({ image: reference }).metadata.runtimeKind ?? fallback
}
