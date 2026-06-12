import { InfrastructureContainersPageEntry } from '@/features/orchestrator/pages/infrastructure-containers/page-entry'
import type { ContainersSearchParams } from '@/features/orchestrator/pages/infrastructure-containers/page-data.server'

export default function OrchestratorContainersPage({
  searchParams
}: {
  searchParams?: Promise<ContainersSearchParams>
}) {
  return <InfrastructureContainersPageEntry searchParams={searchParams} />
}
