import { InfrastructureNetworkDetailPageEntry } from '@/features/orchestrator/pages/infrastructure-network-detail/page-entry'

export default function OrchestratorNetworkDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return <InfrastructureNetworkDetailPageEntry params={params} />
}
