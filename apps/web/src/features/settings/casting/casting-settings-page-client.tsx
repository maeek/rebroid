'use client'

import { useState } from 'react'
import { PlatformPageRefreshButton } from '@/shared/ui/actions/platform-page-refresh-button'
import { PlatformPageHeader } from '@/shared/ui/page/platform-page-header'
import { ProtectedStackPageLayout } from '@/shared/ui/page/protected-page-shell'
import { CastingSidecarSettings } from './casting-sidecar-settings'
import type { AndroidApplication } from '@/server/orchestrator/applications/types'
import type { DisplaySidecarSession, ServiceHealth } from '@/server/orchestrator/diagnostics/types'

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
    <ProtectedStackPageLayout mainClassName='gap-2'>
      <PlatformPageHeader
        title='Casting'
        description='Inspect the casting sidecar and terminate active viewer sessions.'
        breadcrumbRoot={{ label: 'Operations' }}
        actions={
          <PlatformPageRefreshButton
            isRefreshing={isRefreshing}
            onRefresh={refresh}
          />
        }
      />
      <section className='flex w-full flex-col gap-6 px-6 pb-16 max-sm:px-4'>
        <CastingSidecarSettings
          initialHealth={initialHealth}
          initialSessions={initialSessions}
          applications={applications}
          owners={owners}
          refreshKey={refreshKey}
          onRefreshComplete={() => setIsRefreshing(false)}
        />
      </section>
    </ProtectedStackPageLayout>
  )
}
