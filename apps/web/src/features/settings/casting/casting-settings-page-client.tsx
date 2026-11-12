'use client'

import { useCallback, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { PlatformPageRefreshButton } from '@/shared/ui/actions/platform-page-refresh-button'
import { ServiceDetailLayout } from '@/shared/ui/platform/service-detail-layout'
import { CastingSessionsSection } from './casting-sessions-section'
import { CastingSidecarServiceSection } from './casting-sidecar-service-section'
import { useCastingSidecarController } from './use-casting-sidecar-controller'
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
  const completeRefresh = useCallback(() => setIsRefreshing(false), [])
  const controller = useCastingSidecarController({
    initialHealth,
    initialSessions,
    applications,
    refreshKey,
    onRefreshComplete: completeRefresh
  })

  const refreshPage = () => startRefresh(() => router.refresh())
  const refresh = () => {
    setIsRefreshing(true)
    setRefreshKey(current => current + 1)
    refreshPage()
  }

  return (
    <ServiceDetailLayout
      title='Casting'
      navigation={{ section: { label: 'Administration' } }}
      health={controller.health}
      loading={loading}
      gridToolbar
      refresh={
        <PlatformPageRefreshButton
          disabled={loading}
          isRefreshing={isRefreshing || isRefreshingPage}
          onRefresh={refresh}
        />
      }
    >
      <CastingSidecarServiceSection
        loading={loading}
        health={controller.health}
        containerId={isRefreshingPage || controller.busy === 'restart' ? undefined : containerId}
        busy={controller.busy}
        onRestart={() => void controller.restartSidecar().then(refreshPage)}
      />
      {loading || controller.health.ok || controller.sessions.length > 0 ? (
        <CastingSessionsSection
          loading={loading}
          controller={controller}
          applications={applications}
          owners={owners}
        />
      ) : null}
    </ServiceDetailLayout>
  )
}
