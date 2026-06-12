import { Suspense } from 'react'
import { PlatformInventoryPageSkeleton } from '../../components/loaders/orchestrator-page-skeletons'
import { OrchestratorContainersPageClient } from '../../components/orchestrator-containers-page-client'
import { loadInfrastructureContainersPageData, type ContainersSearchParams } from './page-data.server'

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

const InfrastructureContainersPageContent = async ({
  searchParams
}: {
  searchParams?: Promise<ContainersSearchParams>
}) => {
  const { containersPage, gridQuery } = await loadInfrastructureContainersPageData((await searchParams) ?? {})
  return (
    <OrchestratorContainersPageClient
      containersPage={containersPage}
      gridQuery={gridQuery}
    />
  )
}

export function InfrastructureContainersPageEntry({
  searchParams
}: {
  searchParams?: Promise<ContainersSearchParams>
}) {
  return (
    <Suspense fallback={<ContainersPageFallback />}>
      <InfrastructureContainersPageContent searchParams={searchParams} />
    </Suspense>
  )
}
