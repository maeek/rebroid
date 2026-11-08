'use client'
import { Button } from '@/components/ui/button'
import { Section } from '@/components/ui/section'
import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent } from '@/shared/ui/page/page-layout'
import { StateView } from '@/shared/ui/state-view'
import { AppsGalleryToolbar } from './components/apps-gallery-toolbar'
import { AppsGridLayout } from './components/apps-grid-layout'
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
  yourApps,
  currentOwnerUserId,
  initialSettings,
  orchestratorError
}: {
  canCreate: boolean
  yourApps: AppDefinition[]
  currentOwnerUserId: string
  initialSettings: OrchestratorUiSettings
  orchestratorError?: string | null
}) => {
  const { availableApps, search, setSearch, statusFilter, setStatusFilter, contextValue, hasApps } =
    useAppsListController({
      currentOwnerUserId,
      initialSettings,
      yourApps
    })
  const currentUserApps = availableApps.filter(app => app.ownerUserId === currentOwnerUserId)
  const otherUserApps = availableApps.filter(app => app.ownerUserId !== currentOwnerUserId)

  if (orchestratorError) {
    return (
      <>
        <PageHeader
          title='Apps'
          description='Create, monitor, and manage isolated Android applications.'
        />
        <PageContent>
          <StateView
            scope='page'
            kind='unavailable'
            title='Orchestrator unavailable'
            description='The web app is still available, but Android app management is temporarily offline.'
            actions={[{ label: 'Refresh', onClick: () => window.location.reload() }]}
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
          onStatusChange={value => {
            if (
              value === 'all' ||
              value === 'running' ||
              value === 'stopped' ||
              value === 'error' ||
              value === 'working'
            )
              setStatusFilter(value)
          }}
        >
          {availableApps.length ? (
            <div className='grid gap-6'>
              <AppsGridSection
                title='My apps'
                apps={currentUserApps}
              />
              <AppsGridSection
                title='Other users’ apps'
                apps={otherUserApps}
                showOwner
              />
            </div>
          ) : (
            <Section
              surface='panel'
              title='No matching apps'
              description='Try a different name or status.'
            >
              <Button
                variant='ghost'
                className='w-fit'
                onClick={() => {
                  setSearch('')
                  setStatusFilter('all')
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
    <AppsGridLayout
      title={title}
      count={apps.length}
    >
      {apps.map(app => (
        <AppsListItem
          key={app.id}
          app={app}
          showOwner={showOwner}
        />
      ))}
    </AppsGridLayout>
  )
}
