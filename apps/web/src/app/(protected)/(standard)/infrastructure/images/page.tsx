import { InfrastructureImagesPageEntry } from '@/features/orchestrator/pages/infrastructure-images/page-entry'
import type { ImagesSearchParams } from '@/features/orchestrator/pages/infrastructure-images/page-data.server'

export default function OrchestratorImagesPage({ searchParams }: { searchParams?: Promise<ImagesSearchParams> }) {
  return <InfrastructureImagesPageEntry searchParams={searchParams} />
}
