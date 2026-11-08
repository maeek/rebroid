'use client'

import { PlatformPageRefreshButton } from '@/shared/ui/actions/platform-page-refresh-button'
import { PlatformOperationsContent } from './platform-operations-content'
import { PlatformOverviewLayout } from './platform-overview-layout'
import { PlatformCapacityContent } from './platform-quick-glance-section'

export const PlatformOverviewPageSkeleton = () => (
  <PlatformOverviewLayout
    actions={
      <PlatformPageRefreshButton
        disabled
        onRefresh={() => undefined}
      />
    }
    operations={<PlatformOperationsContent snapshot={null} />}
    capacity={<PlatformCapacityContent loading />}
  />
)
