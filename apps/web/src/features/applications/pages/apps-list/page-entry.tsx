import { Suspense } from 'react'
import { AppsList } from '@/features/applications/list/apps-list'
import { AppsPageSkeleton } from '@/features/applications/list/apps-page-skeleton'
import { StandardPage } from '@/shared/ui/page/page-layout'
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
    <StandardPage>
      <Suspense fallback={<AppsPageSkeleton withLayout={false} />}>
        <AppsPageContent />
      </Suspense>
    </StandardPage>
  )
}
