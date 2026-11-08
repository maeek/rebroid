'use client'

import { useCallback, useState } from 'react'
import { PlatformPageRefreshButton } from '@/shared/ui/actions/platform-page-refresh-button'
import { PlatformOperationsSection } from './platform-operations-section'
import { PlatformOverviewLayout } from './platform-overview-layout'
import { PlatformQuickGlanceSection } from './platform-quick-glance-section'

export const PlatformOverviewPageClient = () => {
  const [refreshKey, setRefreshKey] = useState(0)
  const [pendingRefreshes, setPendingRefreshes] = useState(0)

  const refresh = () => {
    setPendingRefreshes(2)
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
