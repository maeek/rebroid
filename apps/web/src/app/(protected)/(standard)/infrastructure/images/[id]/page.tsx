import { InfrastructureImageDetailPageEntry } from '@/features/orchestrator/pages/infrastructure-image-detail/page-entry'

export default function OrchestratorImageDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return <InfrastructureImageDetailPageEntry params={params} />
}
