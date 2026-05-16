'use client'
import { useEffect, useState } from 'react'
import { PageBreadcrumbs } from '@/app/(protected)/_components/page-breadcrumbs'
import { ProtectedStackPageLayout } from '@/app/(protected)/_components/protected-page-shell'
import { trpc } from '@/app/_trpc/client'
import { Section } from '@/components/ui/section'
import { getSystemResourcesAction } from '@/lib/orchestrator/actions'
import { SystemChart } from './_components/chart'
import { DetailsTable } from './_components/details-table'
import { ManagedContainerDetailsTable } from './_components/managed-container-details-table'
import { MemoryChart } from './_components/memory-chart'
import { OrchestratorResources } from './_components/orchestrator-resources'
import type { SystemResources } from '@/lib/orchestrator/types'

export default function SystemPage() {
  const [resources, setResources] = useState<SystemResources>()
  const [isRefreshingResources, setIsRefreshingResources] = useState(false)
  const { data: systemUtilization, isLoading } = trpc.system.getSystemStats.useQuery(undefined, {
    refetchInterval: 5000,
    refetchOnReconnect: true
  })

  const refreshResources = async (refreshVolumes = false) => {
    setIsRefreshingResources(true)
    try {
      setResources(await getSystemResourcesAction(refreshVolumes))
    } finally {
      setIsRefreshingResources(false)
    }
  }

  useEffect(() => {
    void refreshResources()

    const interval = window.setInterval(() => void refreshResources(false), 15000)
    return () => window.clearInterval(interval)
  }, [])

  return isLoading ? (
    <div>Loading...</div>
  ) : (
    <ProtectedStackPageLayout mainClassName='gap-2'>
      <section className='shrink-0 bg-background px-6 py-4 max-sm:px-4'>
        <div className='flex items-center justify-between gap-3 max-sm:flex-col max-sm:items-start'>
          <div className='flex flex-col gap-2'>
            <PageBreadcrumbs
              className='pt-0'
              items={[{ label: 'Settings', href: '/settings/general' }, { label: 'System' }]}
            />
            <h2 className='pt-4 text-3xl font-medium max-sm:text-xl'>System</h2>
          </div>
        </div>
      </section>
      <section className='flex w-full flex-col gap-6 px-6 pb-16 max-sm:px-4'>
        <div className='grid gap-6 xl:grid-cols-2'>
          <Section
            title='Host system'
            boxed
            contentClassName='gap-3'
            className='h-full'
          >
            <p className='text-sm text-secondary-foreground'>
              Operating-system level CPU and memory stats for the machine running the orchestrator.
            </p>
            <DetailsTable systemUtilization={systemUtilization} />
          </Section>
          <Section
            title='Managed containers'
            boxed
            contentClassName='gap-3'
            className='h-full'
          >
            <p className='text-sm text-secondary-foreground'>
              Live aggregated Docker stats across managed app containers, shown separately from host-level usage.
            </p>
            <ManagedContainerDetailsTable resources={resources} />
          </Section>
        </div>
        <OrchestratorResources
          resources={resources}
          isRefreshing={isRefreshingResources}
          onRefresh={refreshResources}
        />
        <div className='grid gap-6 xl:grid-cols-[minmax(20rem,24rem)_minmax(0,1fr)]'>
          <Section
            title='Host memory'
            boxed
            className='h-full'
          >
            <MemoryChart
              totalMemory={systemUtilization?.totalMemoryBytes ?? 0}
              freeMemory={systemUtilization?.freeMemoryBytes ?? 0}
            />
          </Section>
          <Section
            title='Host CPU history'
            boxed
            className='h-full'
          >
            <div className='h-160 w-full max-lg:h-96'>
              <SystemChart cpuData={systemUtilization?.cpuUsagePercentLast50Entrires} />
            </div>
          </Section>
        </div>
      </section>
    </ProtectedStackPageLayout>
  )
}
