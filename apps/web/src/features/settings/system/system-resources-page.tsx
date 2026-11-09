'use client'
import { Visible } from '@/components/ui/visible'
import { usePollingQuery } from '@/hooks/use-polling-query'
import { useSystemResources } from '@/shared/model/platform/use-system-resources'
import { SystemResourcesContent } from './system-resources-content'
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

  const {
    data: systemUtilization,
    isLoading,
    error: systemError,
    isValidating: isRefreshingSystem,
    mutate
  } = usePollingQuery<SystemStats>('system:host-stats', fetchSystemUtilization, { intervalMs: 5000 })
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
        <SystemResourcesContent
          systemUtilization={systemUtilization}
          systemError={Boolean(systemError)}
          isRefreshingSystem={isRefreshingSystem}
          refreshSystem={async () => {
            await mutate()
          }}
          resources={resources}
          resourcesError={resourcesError}
          isRefreshingResources={isRefreshingResources}
          refreshResources={refreshResources}
        />
      </Visible>
    </>
  )
}
