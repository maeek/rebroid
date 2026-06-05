import { OrchestratorAiProvidersPageClient } from '@/features/settings/orchestrator/ai-providers/orchestrator-ai-providers-page-client'
import { listAutomationAiProvidersAction } from '@/server/orchestrator/settings/actions'

export default async function OrchestratorAiProvidersPage() {
  const providers = await listAutomationAiProvidersAction()
  return <OrchestratorAiProvidersPageClient initialProviders={providers} />
}
