import { notFound } from 'next/navigation'
import { OrchestratorAiProviderEditPageClient } from '../../ai-providers/orchestrator-ai-provider-edit-page-client'
import { getAiProviderDetailPageData } from './page-data.server'

type AiProviderDetailPageEntryProps = {
  params: Promise<{ providerId: string }>
  searchParams?: Promise<{ view?: string }>
}

export default async function AiProviderDetailPageEntry({ params, searchParams }: AiProviderDetailPageEntryProps) {
  const { providerId } = await params
  const { provider } = await getAiProviderDetailPageData(providerId)

  if (!provider) {
    notFound()
  }

  const query = await searchParams
  return (
    <OrchestratorAiProviderEditPageClient
      key={provider.id}
      initialProvider={provider}
      view={query?.view === 'connection' ? 'connection' : 'models'}
    />
  )
}
