import type { PlatformImage } from '@/shared/contracts/platform-image'

export const imageDisplayName = (image: PlatformImage) => image.repoTags[0] ?? image.repoDigests[0] ?? image.shortId
