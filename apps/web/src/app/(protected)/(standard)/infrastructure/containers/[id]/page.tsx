import { InfrastructureContainerDetailPageEntry } from '@/features/orchestrator/pages/infrastructure-container-detail/page-entry'

export default function OrchestratorContainerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return <InfrastructureContainerDetailPageEntry params={params} />
}
