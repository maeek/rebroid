import { getPlatformImageAction } from '@/server/orchestrator/platform/image-actions'

export const loadRuntimeImageDetailPageData = async (id: string) => ({
  details: await getPlatformImageAction(id)
})
