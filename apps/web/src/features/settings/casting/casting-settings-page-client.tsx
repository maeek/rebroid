'use client'

import { useState } from 'react'
import { PlatformPageRefreshButton } from '@/shared/ui/actions/platform-page-refresh-button'
import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent, StandardPage } from '@/shared/ui/page/page-layout'
import { CastingSidecarSettings } from './casting-sidecar-settings'
import type { AndroidApplication } from '@/shared/contracts/application'
import type { DisplaySidecarSession, ServiceHealth } from '@/shared/contracts/diagnostics'

export const CastingSettingsPageClient = ({
  initialHealth,
  initialSessions,
  applications,
  owners
}: {
  initialHealth: ServiceHealth
  initialSessions: DisplaySidecarSession[]
  applications: Pick<AndroidApplication, 'id' | 'name' | 'ownerUserId' | 'runtime'>[]
  owners: Array<{ id: string; name: string }>
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
        section={{ label: 'Platform', href: '/platform' }}
        title='Display sessions'
        description='Inspect the display service and end active viewer sessions.'
        actions={
          <PlatformPageRefreshButton
            isRefreshing={isRefreshing}
            onRefresh={refresh}
          />
        }
      />
      <PageContent>
        <CastingSidecarSettings
          initialHealth={initialHealth}
          initialSessions={initialSessions}
          applications={applications}
          owners={owners}
          refreshKey={refreshKey}
          onRefreshComplete={() => setIsRefreshing(false)}
        />
      </PageContent>
    </StandardPage>
  )
}
