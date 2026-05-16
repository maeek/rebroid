'use client'
import { AppsListBulkDialog } from './apps-list/apps-list-bulk-dialog'
import { AppsListProvider } from './apps-list/apps-list-context'
import { AppsListEmptyState } from './apps-list/apps-list-empty-state'
import { AppsListHeader } from './apps-list/apps-list-header'
import { AppsListItem } from './apps-list/apps-list-item'
import { useAppsListController } from './apps-list/use-apps-list-controller'
import type { AppDefinition } from '@/app/(protected)/(standard)/constants'
import type { OrchestratorUiSettings } from '@/lib/orchestrator/settings'

export const AppsList = ({
  yourApps,
  initialSettings
}: {
  yourApps: AppDefinition[]
  initialSettings: OrchestratorUiSettings
}) => {
  const { availableApps, contextValue, hasApps } = useAppsListController({ initialSettings, yourApps })

  if (!hasApps) {
    return <AppsListEmptyState />
  }

  return (
    <AppsListProvider value={contextValue}>
      <AppsListHeader />
      <AppsListBulkDialog />
      <div className='grid gap-x-5 gap-y-12 py-4 px-2 grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-7'>
        {availableApps.map(app => (
          <AppsListItem
            key={app.id}
            app={app}
          />
        ))}
      </div>
    </AppsListProvider>
  )
}
