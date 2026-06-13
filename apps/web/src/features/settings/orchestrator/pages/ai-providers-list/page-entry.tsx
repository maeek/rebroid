import { Suspense } from 'react'
import { PlatformRouteUnavailable } from '@/shared/ui/page/platform-route-unavailable'
import { AiProvidersPageSkeleton } from '../../ai-providers/ai-provider-page-skeletons'
import { OrchestratorAiProvidersPageClient } from '../../ai-providers/orchestrator-ai-providers-page-client'
import { getAiProvidersListPageData } from './page-data.server'

const AiProvidersListContent = async () => {
  const { orchestratorError, providers } = await getAiProvidersListPageData()

  if (orchestratorError) {
    return (
      <PlatformRouteUnavailable
        title='AI providers'
        description='Configure OpenAI, Ollama, and OpenAI-compatible providers used by AI automation steps.'
        detail={orchestratorError}
        href='/orchestrator/ai-providers'
      />
    )
  }

  return <OrchestratorAiProvidersPageClient initialProviders={providers} />
}

export default function AiProvidersListPageEntry() {
  return (
    <Suspense fallback={<AiProvidersPageSkeleton />}>
      <AiProvidersListContent />
    </Suspense>
  )
}
