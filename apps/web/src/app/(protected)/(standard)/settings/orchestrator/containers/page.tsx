import { OrchestratorContainersPageClient } from '@/features/orchestrator/components/orchestrator-containers-page-client'
import { listPlatformContainersGridAction } from '@/server/orchestrator/platform/actions'
import type { PlatformContainersGridQuery } from '@/server/orchestrator/platform/types'

type ContainersSearchParams = Record<string, string | string[] | undefined>

const firstValue = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)

const containersGridQueryFromSearchParams = (searchParams: ContainersSearchParams): PlatformContainersGridQuery => {
  const scope = firstValue(searchParams.scope)
  return {
    page: Math.max(Number(firstValue(searchParams.page)) || 1, 1),
    pageSize: Math.min(Math.max(Number(firstValue(searchParams.pageSize)) || 20, 1), 100),
    q: firstValue(searchParams.q)?.trim() || undefined,
    scope: scope === 'all' ? 'all' : 'managed',
    sort: firstValue(searchParams.sort)?.trim() || undefined
  }
}

export default async function OrchestratorContainersPage({
  searchParams
}: {
  searchParams?: Promise<ContainersSearchParams>
}) {
  const gridQuery = containersGridQueryFromSearchParams((await searchParams) ?? {})
  const containersPage = await listPlatformContainersGridAction(gridQuery)
  return (
    <OrchestratorContainersPageClient
      containersPage={containersPage}
      gridQuery={gridQuery}
    />
  )
}
