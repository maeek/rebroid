'use client'

import { useState } from 'react'
import { PlatformPageRefreshButton } from '@/shared/ui/actions/platform-page-refresh-button'
import { PlatformPageHeader } from '@/shared/ui/page/platform-page-header'
import { ProtectedStackPageLayout } from '@/shared/ui/page/protected-page-shell'
import { RuntimeNetworksSection } from './runtime-networks-section'
import type { PlatformNetworksGridPage, PlatformNetworksGridQuery } from '@/server/orchestrator/platform/types'

export const RuntimeNetworksPageClient = ({
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
        breadcrumbRoot={{ label: 'Runtime' }}
        actions={
          <PlatformPageRefreshButton
            isRefreshing={isRefreshing}
            onRefresh={refresh}
          />
        }
      />
      <section className='flex w-full flex-col gap-6 px-6 pb-16 max-sm:px-4'>
        <RuntimeNetworksSection
          networksPage={networksPage}
          gridQuery={gridQuery}
          refreshKey={refreshKey}
          onRefreshComplete={() => setIsRefreshing(false)}
        />
      </section>
    </ProtectedStackPageLayout>
  )
}
