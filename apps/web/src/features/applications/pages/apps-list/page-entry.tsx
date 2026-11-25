import { Suspense } from 'react'
import { AppsList } from '@/features/applications/list/apps-list'
import { AppsPageSkeleton } from '@/features/applications/list/apps-page-skeleton'
import { StandardPage } from '@/shared/ui/page/page-layout'
import { getAppsListPageData } from './page-data.server'

const AppsPageContent = async () => {
  const {
    apps,
    appsLoadedAt,
    canCreate,
    canStart,
    canStop,
    canDelete,
    canFilterByOwner,
    canViewSnapshots,
    currentOwnerUserId,
    initialSettings,
    orchestratorError
  } = await getAppsListPageData()

  return (
    <AppsList
      canCreate={canCreate}
      canStart={canStart}
      canStop={canStop}
      canDelete={canDelete}
      canFilterByOwner={canFilterByOwner}
      canViewSnapshots={canViewSnapshots}
      yourApps={apps}
      appsLoadedAt={appsLoadedAt}
      currentOwnerUserId={currentOwnerUserId}
      initialSettings={initialSettings}
      orchestratorError={orchestratorError}
    />
  )
}

export const AppsListPageEntry = () => {
  return (
    <StandardPage gridToolbar>
      <Suspense fallback={<AppsPageSkeleton withLayout={false} />}>
        <AppsPageContent />
      </Suspense>
    </StandardPage>
  )
}
