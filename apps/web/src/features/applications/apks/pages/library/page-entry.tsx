import { Suspense } from 'react'
import { OrchestratorPageBoundary } from '@/server/orchestrator/orchestrator-page-boundary'
import { PlatformRouteUnavailable } from '@/shared/ui/page/platform-route-unavailable'
import { ApkLibraryPageClient } from './page-client'
import { authorizeApkLibraryPage, loadApkLibraryPage } from './page-data.server'
import { ApkLibraryPageLoading } from './page-skeleton'

export async function ApkLibraryPageEntry() {
  await authorizeApkLibraryPage()
  return (
    <Suspense fallback={<ApkLibraryPageLoading />}>
      <OrchestratorPageBoundary
        load={loadApkLibraryPage}
        fallback={requestId => (
          <PlatformRouteUnavailable
            requestId={requestId}
            title='APK library'
            description='Could not load uploaded APKs.'
            section={{ label: 'Administration' }}
          />
        )}
      >
        {data => <ApkLibraryPageClient initialData={data} />}
      </OrchestratorPageBoundary>
    </Suspense>
  )
}
