'use client'
import { StatusSplash } from '@/features/shell/components/status-splash'
import { AppsListBulkDialog } from './components/apps-list-bulk-dialog'
import { AppsListProvider } from './components/apps-list-context'
import { AppsListEmptyState } from './components/apps-list-empty-state'
import { AppsListHeader } from './components/apps-list-header'
import { AppsListItem } from './components/apps-list-item'
import { useAppsListController } from './components/use-apps-list-controller'
import type { AppDefinition } from '@/features/applications/domain/app-definition'
import type { OrchestratorUiSettings } from '@/features/settings/hooks/use-orchestrator-ui-settings'

export const AppsList = ({
  yourApps,
  initialSettings,
  orchestratorError
}: {
  yourApps: AppDefinition[]
  initialSettings: OrchestratorUiSettings
  orchestratorError?: string | null
}) => {
  const { availableApps, contextValue, hasApps } = useAppsListController({ initialSettings, yourApps })

  if (orchestratorError) {
    return (
      <section className='px-6 py-8 max-sm:px-4'>
        <StatusSplash
          title='Orchestrator unavailable'
          description='The web app is still available, but Android app management is temporarily offline.'
          detail={orchestratorError}
          tone='danger'
          primaryAction={{ label: 'Refresh', onClick: () => window.location.reload() }}
        />
      </section>
    )
  }

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
