'use client'

import { useMemo, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { PlatformPageRefreshButton } from '@/shared/ui/actions/platform-page-refresh-button'
import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent, StandardPage } from '@/shared/ui/page/page-layout'
import { RuntimeInventoryLoadingSection } from './runtime-inventory-loading-section'
import { RuntimeNetworksSection } from './runtime-networks-section'
import { createNetworkColumns } from './runtime-networks-table-parts'
import type { PlatformNetworksGridPage, PlatformNetworksGridQuery } from '@/shared/contracts/platform'

export const RuntimeNetworksPageClient = ({
  networksPage,
  gridQuery
}: {
  networksPage: PlatformNetworksGridPage
  gridQuery: PlatformNetworksGridQuery
}) => {
  const router = useRouter()
  const [isRefreshing, startRefresh] = useTransition()

  const refresh = () => startRefresh(() => router.refresh())

  return (
    <RuntimeNetworksPageFrame
      isRefreshing={isRefreshing}
      onRefresh={refresh}
    >
      <RuntimeNetworksSection
        networksPage={networksPage}
        gridQuery={gridQuery}
      />
    </RuntimeNetworksPageFrame>
  )
}

const RuntimeNetworksPageFrame = ({
  children,
  isRefreshing = false,
  loading = false,
  onRefresh
}: {
  children: ReactNode
  isRefreshing?: boolean
  loading?: boolean
  onRefresh: () => void
}) => (
  <StandardPage className='gap-2'>
    <PageHeader
      section={{ label: 'Runtime' }}
      title='Networks'
      description='Docker networks visible to the platform, including application isolation networks.'
      actions={
        <PlatformPageRefreshButton
          disabled={loading}
          isRefreshing={isRefreshing}
          onRefresh={onRefresh}
        />
      }
    />
    <PageContent>{children}</PageContent>
  </StandardPage>
)

export const RuntimeNetworksPageLoading = () => {
  const columns = useMemo(() => createNetworkColumns(), [])
  return (
    <RuntimeNetworksPageFrame
      loading
      onRefresh={() => undefined}
    >
      <RuntimeInventoryLoadingSection
        actionLabels={['Remove selected']}
        columns={columns}
        searchPlaceholder='Search networks'
      />
    </RuntimeNetworksPageFrame>
  )
}
