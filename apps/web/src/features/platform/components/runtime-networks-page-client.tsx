'use client'

import { useMemo, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { PlatformPageRefreshButton } from '@/shared/ui/actions/platform-page-refresh-button'
import { StandardPage } from '@/shared/ui/page/page-layout'
import { PlatformPageHeader } from '@/shared/ui/page/platform-page-header'
import { RuntimeInventoryLoadingSection } from './runtime-inventory-loading-section'
import { createNetworkColumns, RuntimeNetworksSection } from './runtime-networks-section'
import type { PlatformNetworksGridPage, PlatformNetworksGridQuery } from '@/server/orchestrator/platform/types'

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
    <PlatformPageHeader
      title='Networks'
      description='Docker networks visible to the platform, including application isolation networks.'
      breadcrumbRoot={{ label: 'Runtime' }}
      actions={
        <PlatformPageRefreshButton
          disabled={loading}
          isRefreshing={isRefreshing}
          onRefresh={onRefresh}
        />
      }
    />
    <section className='flex w-full flex-col gap-6 px-6 pb-16 max-sm:px-4'>{children}</section>
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
