'use client'

import { useState } from 'react'
import { PlatformPageRefreshButton } from '@/shared/ui/actions/platform-page-refresh-button'
import { PlatformPageHeader } from '@/shared/ui/page/platform-page-header'
import { ProtectedStackPageLayout } from '@/shared/ui/page/protected-page-shell'
import { OrchestratorContainersSection } from './orchestrator-containers-section'
import type { PlatformContainersGridPage, PlatformContainersGridQuery } from '@/server/orchestrator/platform/types'

export const OrchestratorContainersPageClient = ({
  containersPage,
  gridQuery
}: {
  containersPage: PlatformContainersGridPage
  gridQuery: PlatformContainersGridQuery
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
        title='Containers'
        description='Docker containers visible to the platform. Managed application containers are shown first.'
        breadcrumbRoot={{ label: 'Infrastructure' }}
        actions={
          <PlatformPageRefreshButton
            isRefreshing={isRefreshing}
            onRefresh={refresh}
          />
        }
      />
      <section className='flex w-full flex-col gap-6 px-6 pb-16 max-sm:px-4'>
        <OrchestratorContainersSection
          containersPage={containersPage}
          gridQuery={gridQuery}
          refreshKey={refreshKey}
          onRefreshComplete={() => setIsRefreshing(false)}
        />
      </section>
    </ProtectedStackPageLayout>
  )
}
