import { Suspense } from 'react'
import { GradientSparklesIcon } from '@/components/icons/gradient-sparkles-icon'
import { PlatformRouteUnavailable } from '@/shared/ui/page/platform-route-unavailable'
import { AiProvidersPageSkeleton } from '../../ai-providers/ai-provider-page-skeletons'
import { OrchestratorAiProvidersPageClient } from '../../ai-providers/orchestrator-ai-providers-page-client'
import { getAiProvidersListPageData } from './page-data.server'

const AiProvidersListContent = async () => {
  const { initialSettings, orchestratorError, providers } = await getAiProvidersListPageData()

  if (orchestratorError) {
    return (
      <PlatformRouteUnavailable
        title='AI'
        titlePrefix={<GradientSparklesIcon className='size-8 max-sm:size-5' />}
        description='Configure OpenAI, Ollama, and OpenAI-compatible providers used by AI automation steps.'
        detail={orchestratorError}
        href='/platform/ai'
      />
    )
  }

  return (
    <OrchestratorAiProvidersPageClient
      initialProviders={providers}
      initialSettings={initialSettings}
    />
  )
}

export default function AiProvidersListPageEntry() {
  return (
    <Suspense fallback={<AiProvidersPageSkeleton />}>
      <AiProvidersListContent />
    </Suspense>
  )
}
