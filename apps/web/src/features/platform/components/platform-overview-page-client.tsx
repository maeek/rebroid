'use client'

import { useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { PlatformPageRefreshButton } from '@/shared/ui/actions/platform-page-refresh-button'
import { PlatformOperationsSection } from './platform-operations-section'
import { PlatformOverviewLayout } from './platform-overview-layout'
import { PlatformQuickGlanceSection } from './platform-quick-glance-section'
import { PlatformRecentApps, recentlyOpenedAppsQueryKey } from './platform-recent-apps'

export const PlatformOverviewPageClient = () => {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [refreshKey, setRefreshKey] = useState(0)
  const [pendingRefreshes, setPendingRefreshes] = useState(0)

  const refresh = () => {
    router.refresh()
    setPendingRefreshes(3)
    void queryClient
      .invalidateQueries({ queryKey: recentlyOpenedAppsQueryKey })
      .finally(() => setPendingRefreshes(current => Math.max(0, current - 1)))
    setRefreshKey(current => current + 1)
  }

  const completeRefresh = useCallback(() => {
    setPendingRefreshes(current => Math.max(current - 1, 0))
  }, [])

  return (
    <PlatformOverviewLayout
      actions={
        <PlatformPageRefreshButton
          isRefreshing={pendingRefreshes > 0}
          onRefresh={refresh}
        />
      }
      recentApps={<PlatformRecentApps />}
      operations={
        <PlatformOperationsSection
          refreshKey={refreshKey}
          onRefreshComplete={completeRefresh}
        />
      }
      capacity={
        <PlatformQuickGlanceSection
          refreshKey={refreshKey}
          onRefreshComplete={completeRefresh}
        />
      }
    />
  )
}
