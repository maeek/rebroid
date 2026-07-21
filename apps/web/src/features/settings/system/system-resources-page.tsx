'use client'
import { Section } from '@/components/ui/section'
import { Visible } from '@/components/ui/visible'
import { SystemChart } from '@/features/settings/system/chart'
import { DetailsTable } from '@/features/settings/system/details-table'
import { ManagedContainerDetailsTable } from '@/features/settings/system/managed-container-details-table'
import { MemoryChart } from '@/features/settings/system/memory-chart'
import { usePollingQuery } from '@/hooks/use-polling-query'
import { useSystemResources } from '@/shared/model/platform/use-system-resources'
import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent, StandardPage } from '@/shared/ui/page/page-layout'
import { PlatformResources } from '@/shared/ui/platform/platform-resources'
import { StateView } from '@/shared/ui/state-view'
import { SystemResourcesPageSkeleton } from './system-resources-page-skeleton'
import type { SystemStats } from '@/shared/contracts/system-stats'

export function SystemResourcesPage() {
  const fetchSystemUtilization = async (): Promise<SystemStats> => {
    const response = await fetch('/api/system/stats', {
      cache: 'no-store'
    })

    if (!response.ok) {
      throw new Error('Could not load system stats.')
    }

    return (await response.json()) as SystemStats
  }

  const { data: systemUtilization, isLoading } = usePollingQuery<SystemStats>(
    'system:host-stats',
    fetchSystemUtilization,
    { intervalMs: 5000 }
  )
  const {
    data: resources,
    error: caughtResourcesError,
    isValidating: isRefreshingResources,
    refresh: refreshResources
  } = useSystemResources()
  const resourcesError = Boolean(caughtResourcesError)

  return (
    <>
      <Visible when={isLoading}>
        <SystemResourcesPageSkeleton />
      </Visible>
      <Visible when={!isLoading}>
        <StandardPage className='gap-2'>
          <PageHeader
            section={{ label: 'System' }}
            title='Resources'
          />
          <PageContent>
            <div className='grid gap-6 xl:grid-cols-2'>
              <Section
                title='Host system'
                surface='panel'
                titleClassName='pb-4'
                contentClassName='gap-3'
                className='h-full'
              >
                <p className='text-sm text-foreground-muted'>
                  Operating-system level CPU and memory stats for the machine running the orchestrator.
                </p>
                <DetailsTable systemUtilization={systemUtilization} />
              </Section>
              <Section
                title='Managed containers'
                surface='panel'
                titleClassName='pb-4'
                contentClassName='gap-3'
                className='h-full'
              >
                <p className='text-sm text-foreground-muted'>
                  Live aggregated Docker stats across managed app containers, shown separately from host-level usage.
                </p>
                <Visible when={resourcesError}>
                  <StateView
                    kind='unavailable'
                    scope='grid'
                    title='Orchestrator resources unavailable'
                    description='Docker inventory could not be loaded from the orchestrator.'
                    actions={[{ label: 'Refresh', onClick: () => void refreshResources() }]}
                    className='min-h-64 p-4'
                  />
                </Visible>
                <Visible when={!resourcesError}>
                  <ManagedContainerDetailsTable resources={resources} />
                </Visible>
              </Section>
            </div>
            <Visible when={!resourcesError}>
              <PlatformResources
                resources={resources}
                isRefreshing={isRefreshingResources}
                onRefresh={refreshResources}
              />
            </Visible>
            <div className='grid gap-6 xl:grid-cols-[minmax(20rem,24rem)_minmax(0,1fr)] min-w-0'>
              <Section
                title='Host memory'
                surface='panel'
                titleClassName='pb-4'
                className='h-full min-w-0'
              >
                <MemoryChart
                  totalMemory={systemUtilization?.totalMemoryBytes ?? 0}
                  freeMemory={systemUtilization?.freeMemoryBytes ?? 0}
                />
              </Section>
              <Section
                title='Host CPU history'
                surface='panel'
                titleClassName='pb-4'
                className='h-full min-w-0'
              >
                <div className='h-160 w-full max-lg:h-96'>
                  <SystemChart cpuData={systemUtilization?.cpuUsagePercentLast50Entrires} />
                </div>
              </Section>
            </div>
          </PageContent>
        </StandardPage>
      </Visible>
    </>
  )
}
