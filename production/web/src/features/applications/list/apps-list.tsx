'use client'
import { Visible } from '@/components/ui/visible'
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
  currentOwnerUserId,
  initialSettings,
  orchestratorError
}: {
  yourApps: AppDefinition[]
  currentOwnerUserId: string
  initialSettings: OrchestratorUiSettings
  orchestratorError?: string | null
}) => {
  const { availableApps, contextValue, hasApps } = useAppsListController({
    currentOwnerUserId,
    initialSettings,
    yourApps
  })
  const currentUserApps = availableApps.filter(app => app.ownerUserId === currentOwnerUserId)
  const otherUserApps = availableApps.filter(app => app.ownerUserId !== currentOwnerUserId)

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
      <div className='flex flex-col gap-10 py-4'>
        <AppsGridSection
          title='My apps'
          apps={currentUserApps}
        />
        <Visible when={otherUserApps.length > 0}>
          <AppsGridSection
            title='Other users'
            apps={otherUserApps}
            showOwner
          />
        </Visible>
      </div>
    </AppsListProvider>
  )
}

const AppsGridSection = ({
  title,
  apps,
  showOwner = false
}: {
  title: string
  apps: AppDefinition[]
  showOwner?: boolean
}) => {
  if (apps.length === 0) {
    return null
  }

  return (
    <section className='px-2'>
      <div className='mb-3 px-4 max-sm:px-2'>
        <h3 className='text-sm font-semibold text-secondary-foreground'>{title}</h3>
      </div>
      <div className='grid grid-cols-4 gap-x-5 gap-y-12 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-7'>
        {apps.map(app => (
          <AppsListItem
            key={app.id}
            app={app}
            showOwner={showOwner}
          />
        ))}
      </div>
    </section>
  )
}
