'use client'

import { useMemo, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { PlatformPageRefreshButton } from '@/shared/ui/actions/platform-page-refresh-button'
import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent, StandardPage } from '@/shared/ui/page/page-layout'
import { RuntimeContainersSection } from './runtime-containers-section'
import { createContainerColumns } from './runtime-containers-table-parts'
import { RuntimeInventoryLoadingSection } from './runtime-inventory-loading-section'
import type { PlatformContainersGridPage, PlatformContainersGridQuery } from '@/server/orchestrator/platform/types'

export const RuntimeContainersPageClient = ({
  containersPage,
  gridQuery
}: {
  containersPage: PlatformContainersGridPage
  gridQuery: PlatformContainersGridQuery
}) => {
  const router = useRouter()
  const [isRefreshing, startRefresh] = useTransition()

  const refresh = () => startRefresh(() => router.refresh())

  return (
    <RuntimeContainersPageFrame
      isRefreshing={isRefreshing}
      onRefresh={refresh}
    >
      <RuntimeContainersSection
        containersPage={containersPage}
        gridQuery={gridQuery}
      />
    </RuntimeContainersPageFrame>
  )
}

const RuntimeContainersPageFrame = ({
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
      title='Containers'
      description='Docker containers visible to the platform. Managed application containers are shown first.'
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

export const RuntimeContainersPageLoading = () => {
  const columns = useMemo(() => createContainerColumns(), [])
  return (
    <RuntimeContainersPageFrame
      loading
      onRefresh={() => undefined}
    >
      <RuntimeInventoryLoadingSection
        actionLabels={['Stop selected', 'Remove selected']}
        columns={columns}
        searchPlaceholder='Search containers'
      />
    </RuntimeContainersPageFrame>
  )
}
