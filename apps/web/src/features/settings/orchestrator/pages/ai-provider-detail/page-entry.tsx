import { notFound } from 'next/navigation'
import { OrchestratorAiProviderEditPageClient } from '../../ai-providers/orchestrator-ai-provider-edit-page-client'
import { getAiProviderDetailPageData } from './page-data.server'

type AiProviderDetailPageEntryProps = {
  params: Promise<{ providerId: string }>
}

export default async function AiProviderDetailPageEntry({ params }: AiProviderDetailPageEntryProps) {
  const { providerId } = await params
  const { provider } = await getAiProviderDetailPageData(providerId)

  if (!provider) {
    notFound()
  }

  return <OrchestratorAiProviderEditPageClient initialProvider={provider} />
}
