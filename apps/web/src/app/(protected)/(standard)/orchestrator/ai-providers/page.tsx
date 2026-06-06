import { Suspense } from 'react'
import { AiProvidersPageSkeleton } from '@/features/settings/orchestrator/ai-providers/ai-provider-page-skeletons'
import { OrchestratorAiProvidersPageClient } from '@/features/settings/orchestrator/ai-providers/orchestrator-ai-providers-page-client'
import { listAutomationAiProvidersAction } from '@/server/orchestrator/settings/actions'

const OrchestratorAiProvidersPageContent = async () => {
  const providers = await listAutomationAiProvidersAction()
  return <OrchestratorAiProvidersPageClient initialProviders={providers} />
}

export default function OrchestratorAiProvidersPage() {
  return (
    <Suspense fallback={<AiProvidersPageSkeleton />}>
      <OrchestratorAiProvidersPageContent />
    </Suspense>
  )
}
