'use client'

import { useState } from 'react'
import { PlatformPageHeader } from '@/features/orchestrator/components/platform-page-header'
import { PlatformPageRefreshButton } from '@/features/orchestrator/components/platform-page-refresh-button'
import { ProtectedStackPageLayout } from '@/features/shell/components/protected-page-shell'
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
    <ProtectedStackPageLayout mainClassName='gap-2'>
      <PlatformPageHeader
        title='Network access'
        description='Apply outbound network restrictions to application containers.'
        includeOrchestratorBreadcrumb={false}
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
    </ProtectedStackPageLayout>
  )
}
