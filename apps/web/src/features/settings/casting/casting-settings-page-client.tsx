'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { PlatformPageRefreshButton } from '@/shared/ui/actions/platform-page-refresh-button'
import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent, StandardPage } from '@/shared/ui/page/page-layout'
import { CastingSidecarSettings } from './casting-sidecar-settings'
import type { AndroidApplication } from '@/shared/contracts/application'
import type { DisplaySidecarSession, ServiceHealth } from '@/shared/contracts/diagnostics'

export const CastingSettingsPageClient = ({
  initialHealth,
  containerId,
  initialSessions,
  applications,
  owners,
  loading = false
}: {
  loading?: boolean
  initialHealth: ServiceHealth
  containerId?: string
  initialSessions: DisplaySidecarSession[]
  applications: Pick<AndroidApplication, 'id' | 'name' | 'ownerUserId' | 'runtime'>[]
  owners: Array<{ id: string; name: string }>
}) => {
  const [refreshKey, setRefreshKey] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isRefreshingPage, startRefresh] = useTransition()
  const router = useRouter()

  const refreshPage = () => startRefresh(() => router.refresh())
  const refresh = () => {
    setIsRefreshing(true)
    setRefreshKey(current => current + 1)
    refreshPage()
  }

  return (
    <StandardPage
      gridToolbar
      className='gap-2'
    >
      <PageHeader
        section={{ label: 'Administration' }}
        title='Casting'
        breadcrumbRefresh={
          <PlatformPageRefreshButton
            disabled={loading}
            isRefreshing={isRefreshing || isRefreshingPage}
            onRefresh={refresh}
          />
        }
      />
      <PageContent>
        <CastingSidecarSettings
          loading={loading}
          initialHealth={initialHealth}
          containerId={isRefreshingPage ? undefined : containerId}
          initialSessions={initialSessions}
          applications={applications}
          owners={owners}
          refreshKey={refreshKey}
          onRefreshComplete={() => setIsRefreshing(false)}
          onRestartComplete={refreshPage}
        />
      </PageContent>
    </StandardPage>
  )
}
