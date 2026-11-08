'use client'

import { PlatformPageRefreshButton } from '@/shared/ui/actions/platform-page-refresh-button'
import { PlatformOperationsContent } from './platform-operations-content'
import { PlatformOverviewLayout } from './platform-overview-layout'
import { PlatformCapacityContent } from './platform-quick-glance-section'
import { PlatformRecentAppsContent } from './platform-recent-apps'

export const PlatformOverviewPageSkeleton = () => (
  <PlatformOverviewLayout
    actions={
      <PlatformPageRefreshButton
        disabled
        onRefresh={() => undefined}
      />
    }
    recentApps={<PlatformRecentAppsContent loading />}
    operations={<PlatformOperationsContent snapshot={null} />}
    capacity={<PlatformCapacityContent loading />}
  />
)
