import type { PlatformImage } from '@/server/orchestrator/platform/types'

export const imageDisplayName = (image: PlatformImage) => image.repoTags[0] ?? image.repoDigests[0] ?? image.shortId
