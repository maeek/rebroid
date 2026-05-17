'use client'
import { useEffect, useState } from 'react'
import { PageBreadcrumbs } from '@/app/(protected)/_components/page-breadcrumbs'
import { ProtectedStackPageLayout } from '@/app/(protected)/_components/protected-page-shell'
import { StatusSplash } from '@/app/(protected)/_components/status-splash'
import { Section } from '@/components/ui/section'
import { Visible } from '@/components/ui/visible'
import { getSystemResourcesAction } from '@/server/orchestrator/diagnostics/actions'
import { SystemChart } from './_components/chart'
import { DetailsTable } from './_components/details-table'
import { ManagedContainerDetailsTable } from './_components/managed-container-details-table'
import { MemoryChart } from './_components/memory-chart'
import { OrchestratorResources } from './_components/orchestrator-resources'
import type { SystemStats } from '@/lib/system/system-stats'
import type { SystemResources } from '@/server/orchestrator/diagnostics/types'

export default function SystemPage() {
  const [resources, setResources] = useState<SystemResources>()
  const [systemUtilization, setSystemUtilization] = useState<SystemStats>()
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshingResources, setIsRefreshingResources] = useState(false)
  const [resourcesError, setResourcesError] = useState<string | null>(null)

  const fetchSystemUtilization = async (): Promise<SystemStats> => {
    const response = await fetch('/api/system/stats', {
      cache: 'no-store'
    })

    if (!response.ok) {
      throw new Error('Could not load system stats.')
    }

    return (await response.json()) as SystemStats
  }

  const refreshResources = async (refreshVolumes = false) => {
    setIsRefreshingResources(true)
    try {
      setResources(await getSystemResourcesAction(refreshVolumes))
      setResourcesError(null)
    } catch (error) {
      setResourcesError(error instanceof Error ? error.message : 'Could not load orchestrator resources.')
    } finally {
      setIsRefreshingResources(false)
    }
  }

  useEffect(() => {
    let isActive = true

    const refresh = async () => {
      try {
        const stats = await fetchSystemUtilization()

        if (isActive) {
          setSystemUtilization(stats)
          setIsLoading(false)
        }
      } catch {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    void refresh()
    const interval = window.setInterval(() => void refresh(), 5000)

    return () => {
      isActive = false
      window.clearInterval(interval)
    }
  }, [])

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
            titleClassName='pb-4'
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
            titleClassName='pb-4'
            contentClassName='gap-3'
            className='h-full'
          >
            <p className='text-sm text-secondary-foreground'>
              Live aggregated Docker stats across managed app containers, shown separately from host-level usage.
            </p>
            {resourcesError ? (
              <StatusSplash
                title='Orchestrator resources unavailable'
                description='Docker inventory could not be loaded from the orchestrator.'
                detail={resourcesError}
                tone='danger'
                primaryAction={{ label: 'Refresh', onClick: () => void refreshResources(true) }}
                className='min-h-64 p-4'
              />
            ) : (
              <ManagedContainerDetailsTable resources={resources} />
            )}
          </Section>
        </div>
        <Visible when={!resourcesError}>
          <OrchestratorResources
            resources={resources}
            isRefreshing={isRefreshingResources}
            onRefresh={refreshResources}
          />
        </Visible>
        <div className='grid gap-6 xl:grid-cols-[minmax(20rem,24rem)_minmax(0,1fr)]'>
          <Section
            title='Host memory'
            boxed
            titleClassName='pb-4'
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
            titleClassName='pb-4'
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
