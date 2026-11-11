'use client'

import { CastingSessionsSection } from './casting-sessions-section'
import { CastingSidecarLogs } from './casting-sidecar-logs'
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
  const canViewLogs = controller.health.ok || typeof controller.health.details?.containerId === 'string'

  return (
    <>
      <CastingSidecarServiceSection
        loading={loading}
        health={controller.health}
        busy={controller.busy}
        onRestart={() => void controller.restartSidecar()}
        logs={
          <CastingSidecarLogs
            disabled={loading || !canViewLogs}
            revision={controller.logRevision}
          />
        }
      />
      {loading || controller.health.ok || controller.sessions.length > 0 ? (
        <CastingSessionsSection
          loading={loading}
          controller={controller}
          applications={applications}
          owners={owners}
        />
      ) : null}
    </>
  )
}
