import { listAutomationAiProvidersAction } from '@/server/orchestrator/settings/actions'

export const getAiProvidersListPageData = async () => ({
  providers: await listAutomationAiProvidersAction()
})
