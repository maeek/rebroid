'use client'

import { useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { PlatformPageRefreshButton } from '@/shared/ui/actions/platform-page-refresh-button'
import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent, StandardPage } from '@/shared/ui/page/page-layout'
import { runtimeInventoryPageHeaders } from '../pages/runtime-inventory-page-headers'

export const useInventoryRefresh = (version: unknown) => {
  const router = useRouter()
  const [isRefreshing, startRefresh] = useTransition()
  return {
    isRefreshing,
    onRefresh: () => startRefresh(() => router.refresh()),
    refreshResult: { version, succeeded: true }
  }
}

export const RuntimeInventoryPage = ({
  resource,
  actions,
  refresh,
  children
}: {
  resource: keyof typeof runtimeInventoryPageHeaders
  actions?: ReactNode
  refresh?: ReturnType<typeof useInventoryRefresh>
  children: ReactNode
}) => (
  <StandardPage
    gridToolbar
    className='gap-2'
  >
    <PageHeader
      section={{ label: 'Docker' }}
      {...runtimeInventoryPageHeaders[resource]}
      actions={actions}
      breadcrumbRefresh={
        <PlatformPageRefreshButton
          disabled={!refresh}
          isRefreshing={refresh?.isRefreshing}
          refreshResult={refresh?.refreshResult}
          onRefresh={refresh?.onRefresh ?? (() => undefined)}
        />
      }
    />
    <PageContent>{children}</PageContent>
  </StandardPage>
)
