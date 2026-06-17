'use client'
import { Section } from '@/components/ui/section'
import { Visible } from '@/components/ui/visible'
import { SystemChart } from '@/features/settings/system/chart'
import { DetailsTable } from '@/features/settings/system/details-table'
import { ManagedContainerDetailsTable } from '@/features/settings/system/managed-container-details-table'
import { MemoryChart } from '@/features/settings/system/memory-chart'
import { usePollingQuery } from '@/hooks/use-polling-query'
import { getDisplayErrorMessage } from '@/lib/error-utils'
import { useSystemResources } from '@/shared/model/platform/use-system-resources'
import { PageBreadcrumbs } from '@/shared/ui/page/page-breadcrumbs'
import { ProtectedStackPageLayout } from '@/shared/ui/page/protected-page-shell'
import { PlatformResources } from '@/shared/ui/platform/platform-resources'
import { StatusSplash } from '@/shared/ui/status-splash'
import { SystemResourcesPageSkeleton } from './system-resources-page-skeleton'
import type { SystemStats } from '@/server/system/system-stats'

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
  const resourcesError = caughtResourcesError
    ? getDisplayErrorMessage(caughtResourcesError, 'Could not load orchestrator resources.')
    : null

  return (
    <>
      <Visible when={isLoading}>
        <SystemResourcesPageSkeleton />
      </Visible>
      <Visible when={!isLoading}>
        <ProtectedStackPageLayout mainClassName='gap-2'>
          <section className='shrink-0 px-6 py-4 max-sm:px-4'>
            <div className='flex items-center justify-between gap-3 max-sm:flex-col max-sm:items-start'>
              <div className='flex flex-col gap-2'>
                <PageBreadcrumbs
                  className='pt-0'
                  items={[{ label: 'System' }, { label: 'Resources' }]}
                />
                <h2 className='pt-4 text-3xl font-medium max-sm:text-xl'>Resources</h2>
              </div>
            </div>
          </section>
          <section className='flex w-full flex-col gap-6 px-6 pb-16 max-sm:px-4'>
            <div className='grid gap-6 xl:grid-cols-2'>
              <Section
                title='Host system'
                boxed
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
                boxed
                titleClassName='pb-4'
                contentClassName='gap-3'
                className='h-full'
              >
                <p className='text-sm text-foreground-muted'>
                  Live aggregated Docker stats across managed app containers, shown separately from host-level usage.
                </p>
                <Visible when={resourcesError}>
                  <StatusSplash
                    title='Orchestrator resources unavailable'
                    description='Docker inventory could not be loaded from the orchestrator.'
                    detail={resourcesError}
                    tone='danger'
                    primaryAction={{ label: 'Refresh', onClick: () => void refreshResources() }}
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
                boxed
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
                boxed
                titleClassName='pb-4'
                className='h-full min-w-0'
              >
                <div className='h-160 w-full max-lg:h-96'>
                  <SystemChart cpuData={systemUtilization?.cpuUsagePercentLast50Entrires} />
                </div>
              </Section>
            </div>
          </section>
        </ProtectedStackPageLayout>
      </Visible>
    </>
  )
}
