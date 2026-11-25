'use client'
import { AppGalleryGrid } from '@/shared/ui/app-icon/app-gallery-grid'
import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent } from '@/shared/ui/page/page-layout'
import { PageLoadFailure } from '@/shared/ui/page/page-load-failure'
import { StateView } from '@/shared/ui/state-view'
import { AppsGalleryToolbar } from './components/apps-gallery-toolbar'
import { AppsListBulkDialog } from './components/apps-list-bulk-dialog'
import { AppsListProvider } from './components/apps-list-context'
import { AppsListEmptyState } from './components/apps-list-empty-state'
import { AppsListHeader } from './components/apps-list-header'
import { AppsListItem } from './components/apps-list-item'
import { useAppsListController } from './components/use-apps-list-controller'
import type { AppGalleryItem } from '@/shared/contracts/application-gallery'
import type { OrchestratorUiSettings } from '@/shared/model/settings/orchestrator-ui-settings'

type AppsListProps = {
  canCreate: boolean
  canStart?: boolean
  canStop?: boolean
  canDelete?: boolean
  canFilterByOwner: boolean
  canViewSnapshots?: boolean
  yourApps: AppGalleryItem[]
  appsLoadedAt?: number
  currentOwnerUserId: string
  initialSettings: OrchestratorUiSettings
  orchestratorError?: string | null
}

export const AppsList = ({ orchestratorError, ...props }: AppsListProps) =>
  orchestratorError ? (
    <>
      <PageHeader
        title='Apps'
        description='Manage your container apps.'
      />
      <PageContent>
        <PageLoadFailure
          title='Orchestrator unavailable'
          description='The web app is still available, but Android app management is temporarily offline.'
          backAction={{ label: 'Go to overview', href: '/platform' }}
        />
      </PageContent>
    </>
  ) : (
    <AppsListContent {...props} />
  )

const AppsListContent = ({
  canCreate,
  canStart = false,
  canStop = false,
  canDelete = false,
  canFilterByOwner,
  canViewSnapshots = false,
  yourApps,
  appsLoadedAt,
  currentOwnerUserId,
  initialSettings
}: Omit<AppsListProps, 'orchestratorError'>) => {
  const {
    visibleApps,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    ownershipFilter,
    setOwnershipFilter,
    contextValue,
    hasApps
  } = useAppsListController({
    canStop,
    canDelete,
    currentOwnerUserId,
    initialSettings,
    yourApps,
    appsLoadedAt
  })

  return (
    <AppsListProvider value={contextValue}>
      <AppsListHeader canCreate={canCreate} />
      <AppsListBulkDialog />
      <PageContent>
        <AppsGalleryToolbar
          search={search}
          onSearchChange={setSearch}
          status={statusFilter}
          onStatusChange={setStatusFilter}
          ownership={canFilterByOwner ? ownershipFilter : undefined}
          onOwnershipChange={setOwnershipFilter}
          canSelect={hasApps}
        >
          {!hasApps ? (
            <AppsListEmptyState canCreate={canCreate} />
          ) : visibleApps.length ? (
            <AppGalleryGrid>
              {visibleApps.map(app => (
                <AppsListItem
                  key={app.id}
                  app={app}
                  showOwner={app.ownerUserId !== currentOwnerUserId}
                  canClone={canCreate && app.ownerUserId !== currentOwnerUserId}
                  canStart={canStart && app.ownerUserId === currentOwnerUserId}
                  canStop={canStop && app.ownerUserId === currentOwnerUserId}
                  canDelete={canDelete}
                  canViewSnapshot={canViewSnapshots && app.ownerUserId === currentOwnerUserId}
                />
              ))}
            </AppGalleryGrid>
          ) : (
            <StateView
              kind='no-results'
              scope='grid'
              artworkSize='page'
              headingLevel={2}
              title='No matching apps'
              description='Try a different search or clear the filters.'
              actions={[
                {
                  label: 'Clear search and filters',
                  variant: 'ghost',
                  onClick: () => {
                    setSearch('')
                    setStatusFilter('all')
                    setOwnershipFilter('all')
                  }
                }
              ]}
            />
          )}
        </AppsGalleryToolbar>
      </PageContent>
    </AppsListProvider>
  )
}
