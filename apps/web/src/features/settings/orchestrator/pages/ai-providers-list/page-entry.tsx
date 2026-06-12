import { Suspense } from 'react'
import { AiProvidersPageSkeleton } from '../../ai-providers/ai-provider-page-skeletons'
import { OrchestratorAiProvidersPageClient } from '../../ai-providers/orchestrator-ai-providers-page-client'
import { getAiProvidersListPageData } from './page-data.server'

const AiProvidersListContent = async () => {
  const { providers } = await getAiProvidersListPageData()

  return <OrchestratorAiProvidersPageClient initialProviders={providers} />
}

export default function AiProvidersListPageEntry() {
  return (
    <Suspense fallback={<AiProvidersPageSkeleton />}>
      <AiProvidersListContent />
    </Suspense>
  )
}
