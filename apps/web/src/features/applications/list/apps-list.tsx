'use client'
import { Button } from '@/components/ui/button'
import { Section } from '@/components/ui/section'
import { AppGalleryGrid } from '@/shared/ui/app-icon/app-gallery-grid'
import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent } from '@/shared/ui/page/page-layout'
import { PageLoadFailure } from '@/shared/ui/page/page-load-failure'
import { AppsGalleryToolbar } from './components/apps-gallery-toolbar'
import { AppsListBulkDialog } from './components/apps-list-bulk-dialog'
import { AppsListProvider } from './components/apps-list-context'
import { AppsListEmptyState } from './components/apps-list-empty-state'
import { AppsListHeader } from './components/apps-list-header'
import { AppsListItem } from './components/apps-list-item'
import { useAppsListController } from './components/use-apps-list-controller'
import type { AppDefinition } from '@/features/applications/domain/app-definition'
import type { OrchestratorUiSettings } from '@/shared/model/settings/use-orchestrator-ui-settings'

export const AppsList = ({
  canCreate,
  canFilterByOwner,
  yourApps,
  currentOwnerUserId,
  initialSettings,
  orchestratorError
}: {
  canCreate: boolean
  canFilterByOwner: boolean
  yourApps: AppDefinition[]
  currentOwnerUserId: string
  initialSettings: OrchestratorUiSettings
  orchestratorError?: string | null
}) => {
  const {
    availableApps,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    ownershipFilter,
    setOwnershipFilter,
    contextValue,
    hasApps
  } = useAppsListController({
    currentOwnerUserId,
    initialSettings,
    yourApps
  })

  if (orchestratorError) {
    return (
      <>
        <PageHeader
          title='Apps'
          description='Create, monitor, and manage isolated Android applications.'
        />
        <PageContent>
          <PageLoadFailure
            title='Orchestrator unavailable'
            description='The web app is still available, but Android app management is temporarily offline.'
            backAction={{ label: 'Go to overview', href: '/platform' }}
          />
        </PageContent>
      </>
    )
  }

  if (!hasApps) {
    return <AppsListEmptyState canCreate={canCreate} />
  }

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
        >
          {availableApps.length ? (
            <AppGalleryGrid>
              {availableApps.map(app => (
                <AppsListItem
                  key={app.id}
                  app={app}
                  showOwner={app.ownerUserId !== currentOwnerUserId}
                  canClone={canCreate && app.ownerUserId !== currentOwnerUserId}
                />
              ))}
            </AppGalleryGrid>
          ) : (
            <Section
              surface='panel'
              title='No matching apps'
              description='Try a different search or clear the filters.'
            >
              <Button
                variant='ghost'
                className='w-fit'
                onClick={() => {
                  setSearch('')
                  setStatusFilter('all')
                  setOwnershipFilter('all')
                }}
              >
                Clear search and filters
              </Button>
            </Section>
          )}
        </AppsGalleryToolbar>
      </PageContent>
    </AppsListProvider>
  )
}
