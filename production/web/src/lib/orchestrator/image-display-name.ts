import type { PlatformImage } from '@/lib/orchestrator/types'

export const imageDisplayName = (image: PlatformImage) => image.repoTags[0] ?? image.repoDigests[0] ?? image.shortId
