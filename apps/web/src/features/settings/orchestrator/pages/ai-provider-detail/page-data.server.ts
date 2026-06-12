import { listAutomationAiProvidersAction } from '@/server/orchestrator/settings/actions'

export const getAiProviderDetailPageData = async (providerId: string) => {
  const providers = await listAutomationAiProvidersAction()

  return {
    provider: providers.find(item => item.id === decodeURIComponent(providerId))
  }
}
