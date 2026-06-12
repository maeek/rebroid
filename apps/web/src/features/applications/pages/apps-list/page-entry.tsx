import { Suspense } from 'react'
import { AppsList } from '@/features/applications/list/apps-list'
import { AppsPageSkeleton } from '@/features/applications/list/apps-page-skeleton'
import { ProtectedStackPageLayout } from '@/shared/ui/page/protected-page-shell'
import { getAppsListPageData } from './page-data.server'

const AppsPageContent = async () => {
  const { apps, currentOwnerUserId, initialSettings, orchestratorError } = await getAppsListPageData()

  return (
    <AppsList
      yourApps={apps}
      currentOwnerUserId={currentOwnerUserId}
      initialSettings={initialSettings}
      orchestratorError={orchestratorError}
    />
  )
}

export const AppsListPageEntry = () => {
  return (
    <ProtectedStackPageLayout>
      <Suspense fallback={<AppsPageSkeleton withLayout={false} />}>
        <AppsPageContent />
      </Suspense>
    </ProtectedStackPageLayout>
  )
}
