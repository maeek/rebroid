import { notFound } from 'next/navigation'
import { OrchestratorAiProviderEditPageClient } from '@/features/settings/orchestrator/ai-providers/orchestrator-ai-provider-edit-page-client'
import { listAutomationAiProvidersAction } from '@/server/orchestrator/settings/actions'

const OrchestratorAiProviderEditPage = async ({ params }: { params: Promise<{ providerId: string }> }) => {
  const { providerId } = await params
  const providers = await listAutomationAiProvidersAction()
  const provider = providers.find(item => item.id === decodeURIComponent(providerId))

  if (!provider) {
    notFound()
  }

  return <OrchestratorAiProviderEditPageClient initialProvider={provider} />
}

export default OrchestratorAiProviderEditPage
