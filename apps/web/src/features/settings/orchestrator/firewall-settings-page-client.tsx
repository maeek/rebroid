'use client'

import { useState } from 'react'
import { PlatformPageRefreshButton } from '@/shared/ui/actions/platform-page-refresh-button'
import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent, StandardPage } from '@/shared/ui/page/page-layout'
import { FirewallSettings } from './firewall-settings'
import type { AndroidApplication } from '@/shared/contracts/application'
import type { ServiceHealth } from '@/shared/contracts/diagnostics'

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
      <PageHeader
        section={{ label: 'Security' }}
        title='Network policies'
        description='Apply outbound network restrictions to application containers.'
        actions={
          <PlatformPageRefreshButton
            isRefreshing={isRefreshing}
            onRefresh={refresh}
          />
        }
      />
      <PageContent>
        <FirewallSettings
          initialHealth={initialHealth}
          initialApplications={initialApplications}
          refreshKey={refreshKey}
          onRefreshComplete={() => setIsRefreshing(false)}
        />
      </PageContent>
    </StandardPage>
  )
}
