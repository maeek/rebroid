'use client'

import { useState } from 'react'
import { PlatformPageRefreshButton } from '@/shared/ui/actions/platform-page-refresh-button'
import { PlatformPageHeader } from '@/shared/ui/page/platform-page-header'
import { StandardPage } from '@/shared/ui/page/page-layout'
import { FirewallSettings } from './firewall-settings'
import type { AndroidApplication } from '@/server/orchestrator/applications/types'
import type { ServiceHealth } from '@/server/orchestrator/diagnostics/types'

export const FirewallSettingsPageClient = ({
  initialHealth,
  initialApplications
}: {
  initialHealth: ServiceHealth
  initialApplications: AndroidApplication[]
}) => {
  const [refreshKey, setRefreshKey] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const refresh = () => {
    setIsRefreshing(true)
    setRefreshKey(current => current + 1)
  }

  return (
    <StandardPage className='gap-2'>
      <PlatformPageHeader
        title='Network policies'
        description='Apply outbound network restrictions to application containers.'
        breadcrumbRoot={{ label: 'Security' }}
        actions={
          <PlatformPageRefreshButton
            isRefreshing={isRefreshing}
            onRefresh={refresh}
          />
        }
      />
      <section className='flex w-full flex-col gap-6 px-6 pb-16 max-sm:px-4'>
        <FirewallSettings
          initialHealth={initialHealth}
          initialApplications={initialApplications}
          refreshKey={refreshKey}
          onRefreshComplete={() => setIsRefreshing(false)}
        />
      </section>
    </StandardPage>
  )
}
