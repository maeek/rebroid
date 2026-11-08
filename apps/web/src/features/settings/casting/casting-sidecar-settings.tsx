'use client'

import { CastingSessionsSection } from './casting-sessions-section'
import { CastingSidecarServiceSection } from './casting-sidecar-service-section'
import { useCastingSidecarController } from './use-casting-sidecar-controller'
import type { AndroidApplication } from '@/shared/contracts/application'
import type { DisplaySidecarSession, ServiceHealth } from '@/shared/contracts/diagnostics'

export const CastingSidecarSettings = ({
  loading = false,
  initialHealth,
  initialSessions,
  applications,
  owners,
  refreshKey = 0,
  onRefreshComplete
}: {
  loading?: boolean
  initialHealth: ServiceHealth
  initialSessions: DisplaySidecarSession[]
  applications: Pick<AndroidApplication, 'id' | 'name' | 'ownerUserId' | 'runtime'>[]
  owners: Array<{ id: string; name: string }>
  refreshKey?: number
  onRefreshComplete?: () => void
}) => {
  const controller = useCastingSidecarController({
    initialHealth,
    initialSessions,
    applications,
    refreshKey,
    onRefreshComplete
  })

  return (
    <>
      <CastingSidecarServiceSection
        loading={loading}
        health={controller.health}
        busy={controller.busy}
        onRestart={() => void controller.restartSidecar()}
      />
      <CastingSessionsSection
        loading={loading}
        controller={controller}
        applications={applications}
        owners={owners}
      />
    </>
  )
}
