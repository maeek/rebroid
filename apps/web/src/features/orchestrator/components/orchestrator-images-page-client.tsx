'use client'

import { useState } from 'react'
import { PlatformPageHeader } from '@/features/orchestrator/components/platform-page-header'
import { PlatformPageRefreshButton } from '@/features/orchestrator/components/platform-page-refresh-button'
import { ProtectedStackPageLayout } from '@/features/shell/components/protected-page-shell'
import { OrchestratorImagesSection } from './orchestrator-images-section'
import type { PlatformImagesGridPage, PlatformImagesGridQuery } from '@/server/orchestrator/platform/types'

export const OrchestratorImagesPageClient = ({
  imagesPage,
  gridQuery
}: {
  imagesPage: PlatformImagesGridPage
  gridQuery: PlatformImagesGridQuery
}) => {
  const [refreshKey, setRefreshKey] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const refresh = () => {
    setIsRefreshing(true)
    setRefreshKey(current => current + 1)
  }

  return (
    <ProtectedStackPageLayout mainClassName='gap-2'>
      <PlatformPageHeader
        title='Images'
        description='Local images available to application containers, custom runtimes, and platform sidecars.'
        actions={
          <PlatformPageRefreshButton
            isRefreshing={isRefreshing}
            onRefresh={refresh}
          />
        }
      />
      <section className='flex w-full flex-col gap-6 px-6 pb-16 max-sm:px-4'>
        <OrchestratorImagesSection
          imagesPage={imagesPage}
          gridQuery={gridQuery}
          refreshKey={refreshKey}
          onRefreshComplete={() => setIsRefreshing(false)}
        />
      </section>
    </ProtectedStackPageLayout>
  )
}
