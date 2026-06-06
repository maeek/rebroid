import { Suspense } from 'react'
import { PlatformInventoryPageSkeleton } from '@/features/orchestrator/components/loaders/orchestrator-page-skeletons'
import { OrchestratorContainersPageClient } from '@/features/orchestrator/components/orchestrator-containers-page-client'
import { listPlatformContainersGridAction } from '@/server/orchestrator/platform/container-actions'
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

const ContainersPageFallback = () => (
  <PlatformInventoryPageSkeleton
    titleWidth='w-48 max-sm:w-32'
    sectionTitleWidth='w-28'
    minWidth='90rem'
    columns={[
      { width: '18rem', headerWidth: 'w-24', kind: 'stacked' },
      { width: '8rem', headerWidth: 'w-16', kind: 'badge' },
      { width: '24rem', headerWidth: 'w-14', kind: 'text', cellWidth: 'w-[84%]' },
      { width: '16rem', headerWidth: 'w-20', kind: 'text', cellWidth: 'w-[68%]' },
      { width: '18rem', headerWidth: 'w-[4.5rem]', kind: 'text', cellWidth: 'w-[74%]' },
      { width: '16rem', headerWidth: 'w-16', kind: 'actions' }
    ]}
  />
)

const OrchestratorContainersPageContent = async ({
  searchParams
}: {
  searchParams?: Promise<ContainersSearchParams>
}) => {
  const gridQuery = containersGridQueryFromSearchParams((await searchParams) ?? {})
  const containersPage = await listPlatformContainersGridAction(gridQuery)
  return (
    <OrchestratorContainersPageClient
      containersPage={containersPage}
      gridQuery={gridQuery}
    />
  )
}

export default function OrchestratorContainersPage({
  searchParams
}: {
  searchParams?: Promise<ContainersSearchParams>
}) {
  return (
    <Suspense fallback={<ContainersPageFallback />}>
      <OrchestratorContainersPageContent searchParams={searchParams} />
    </Suspense>
  )
}
