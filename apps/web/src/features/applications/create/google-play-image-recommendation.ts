import {
  findPlatformImageByReference,
  resolvePlatformImageRuntimeMetadata
} from '@/shared/model/runtime-image/runtime-image-metadata'
import type { PlatformImage } from '@/shared/contracts/platform-image'

export const recommendGooglePlayImage = (images: PlatformImage[], selectedReference: string) => {
  const selected = findPlatformImageByReference(images, selectedReference)
  const selectedMetadata = selected ? resolvePlatformImageRuntimeMetadata(selected).metadata : null
  const candidates = images.filter(image => resolvePlatformImageRuntimeMetadata(image).metadata.gmsMode === 'gapps')

  candidates.sort((left, right) => {
    const leftRank = recommendationRank(left, selectedMetadata?.androidVersion ?? null)
    const rightRank = recommendationRank(right, selectedMetadata?.androidVersion ?? null)
    if (leftRank !== rightRank) return leftRank - rightRank
    return Date.parse(right.createdAt) - Date.parse(left.createdAt)
  })
  return candidates[0] ?? null
}

const recommendationRank = (image: PlatformImage, selectedAndroidVersion: string | null) => {
  const metadata = resolvePlatformImageRuntimeMetadata(image).metadata
  if (
    selectedAndroidVersion &&
    metadata.androidVersion === selectedAndroidVersion &&
    metadata.architecture === 'amd64'
  ) {
    return 0
  }
  if (metadata.androidVersion === '14') return 1
  if (metadata.androidVersion === '13') return 2
  return 3
}
