'use client'

import { useCallback, useRef, useState } from 'react'
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
  const [refreshResult, setRefreshResult] = useState({ version: 0, succeeded: false })
  const batch = useRef({ pending: 0, succeeded: true })
  const completeRefresh = useCallback((succeeded: boolean) => {
    const current = batch.current
    if (current.pending === 0) return
    current.succeeded &&= succeeded
    current.pending -= 1
    setPendingRefreshes(current.pending)
    if (current.pending === 0) {
      setRefreshResult(previous => ({ version: previous.version + 1, succeeded: current.succeeded }))
    }
  }, [])

  const refresh = () => {
    router.refresh()
    batch.current = { pending: 3, succeeded: true }
    setPendingRefreshes(3)
    void queryClient.invalidateQueries({ queryKey: recentlyOpenedAppsQueryKey }, { throwOnError: true }).then(
      () => completeRefresh(true),
      () => completeRefresh(false)
    )
    setRefreshKey(current => current + 1)
  }

  return (
    <PlatformOverviewLayout
      actions={
        <PlatformPageRefreshButton
          refreshResult={refreshResult}
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
