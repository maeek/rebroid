import { notFound } from 'next/navigation'
import { OrchestratorPageBoundary } from '@/server/orchestrator/orchestrator-page-boundary'
import { PlatformRouteUnavailable } from '@/shared/ui/page/platform-route-unavailable'
import { OrchestratorAiProviderEditPageClient } from '../../ai-providers/orchestrator-ai-provider-edit-page-client'
import { getAiProviderDetailPageData } from './page-data.server'

type AiProviderDetailPageEntryProps = {
  params: Promise<{ providerId: string }>
  searchParams?: Promise<{ view?: string }>
}

export default async function AiProviderDetailPageEntry({ params, searchParams }: AiProviderDetailPageEntryProps) {
  const { providerId } = await params
  const query = await searchParams
  const view = query?.view === 'connection' ? 'connection' : 'models'
  return (
    <OrchestratorPageBoundary
      load={health => getAiProviderDetailPageData(providerId, health, view)}
      fallback={requestId => (
        <PlatformRouteUnavailable
          requestId={requestId}
          title='AI provider'
          description='Manage provider models and connection settings.'
          section={{ label: 'Administration' }}
          trail={[{ label: 'AI', href: '/platform/ai' }]}
        />
      )}
    >
      {({ provider, containerId }) => {
        if (!provider) notFound()
        return (
          <OrchestratorAiProviderEditPageClient
            key={provider.id}
            initialProvider={provider}
            containerId={containerId}
            view={view}
          />
        )
      }}
    </OrchestratorPageBoundary>
  )
}
