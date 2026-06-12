import { InfrastructureNetworksPageEntry } from '@/features/orchestrator/pages/infrastructure-networks/page-entry'
import type { NetworksSearchParams } from '@/features/orchestrator/pages/infrastructure-networks/page-data.server'

export default function OrchestratorNetworksPage({ searchParams }: { searchParams?: Promise<NetworksSearchParams> }) {
  return <InfrastructureNetworksPageEntry searchParams={searchParams} />
}
