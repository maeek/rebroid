import { getPlatformImageAction } from '@/server/orchestrator/platform/image-actions'

export const loadInfrastructureImageDetailPageData = async (id: string) => ({
  details: await getPlatformImageAction(id)
})
