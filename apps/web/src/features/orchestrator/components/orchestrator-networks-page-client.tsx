'use client'

import { useState } from 'react'
import { PlatformPageHeader } from '@/features/orchestrator/components/platform-page-header'
import { PlatformPageRefreshButton } from '@/features/orchestrator/components/platform-page-refresh-button'
import { ProtectedStackPageLayout } from '@/features/shell/components/protected-page-shell'
import { OrchestratorNetworksSection } from './orchestrator-networks-section'
import type { PlatformNetworksGridPage, PlatformNetworksGridQuery } from '@/server/orchestrator/platform/types'

export const OrchestratorNetworksPageClient = ({
  networksPage,
  gridQuery
}: {
  networksPage: PlatformNetworksGridPage
  gridQuery: PlatformNetworksGridQuery
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
        title='Networks'
        description='Docker networks visible to the platform, including application isolation networks.'
        breadcrumbRoot={{ label: 'Infrastructure' }}
        actions={
          <PlatformPageRefreshButton
            isRefreshing={isRefreshing}
            onRefresh={refresh}
          />
        }
      />
      <section className='flex w-full flex-col gap-6 px-6 pb-16 max-sm:px-4'>
        <OrchestratorNetworksSection
          networksPage={networksPage}
          gridQuery={gridQuery}
          refreshKey={refreshKey}
          onRefreshComplete={() => setIsRefreshing(false)}
        />
      </section>
    </ProtectedStackPageLayout>
  )
}
