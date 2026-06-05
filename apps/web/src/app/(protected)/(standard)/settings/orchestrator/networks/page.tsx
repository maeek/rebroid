import { OrchestratorNetworksPageClient } from '@/features/orchestrator/components/orchestrator-networks-page-client'
import { listPlatformNetworksGridAction } from '@/server/orchestrator/platform/actions'
import type { PlatformNetworksGridQuery } from '@/server/orchestrator/platform/types'

type NetworksSearchParams = Record<string, string | string[] | undefined>

const firstValue = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)

const networksGridQueryFromSearchParams = (searchParams: NetworksSearchParams): PlatformNetworksGridQuery => {
  const scope = firstValue(searchParams.scope)
  return {
    page: Math.max(Number(firstValue(searchParams.page)) || 1, 1),
    pageSize: Math.min(Math.max(Number(firstValue(searchParams.pageSize)) || 20, 1), 100),
    q: firstValue(searchParams.q)?.trim() || undefined,
    scope: scope === 'all' ? 'all' : 'managed',
    sort: firstValue(searchParams.sort)?.trim() || undefined
  }
}

export default async function OrchestratorNetworksPage({
  searchParams
}: {
  searchParams?: Promise<NetworksSearchParams>
}) {
  const gridQuery = networksGridQueryFromSearchParams((await searchParams) ?? {})
  const networksPage = await listPlatformNetworksGridAction(gridQuery)
  return (
    <OrchestratorNetworksPageClient
      networksPage={networksPage}
      gridQuery={gridQuery}
    />
  )
}
