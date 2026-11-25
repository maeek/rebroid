'use client'

import { useCallback, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Section } from '@/components/ui/section'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { PlatformPageRefreshButton } from '@/shared/ui/actions/platform-page-refresh-button'
import { ServiceDetailLayout } from '@/shared/ui/platform/service-detail-layout'
import { ResourceLink } from '@/shared/ui/resource-link'
import { CastingSessionsSection } from './casting-sessions-section'
import { CastingSidecarServiceSection } from './casting-sidecar-service-section'
import { useCastingSidecarController } from './use-casting-sidecar-controller'
import type { CastingApplication } from './casting-sidecar-utils'
import type { DisplaySidecarSession, ServiceHealth } from '@/shared/contracts/diagnostics'
import type { ExternalDeviceAvailability } from '@/shared/contracts/external-device'

const brokerStatus = {
  available: {
    label: 'Available',
    tone: 'success',
    detail: 'The broker accepted its configuration and can serve verified attachments.'
  },
  feature_disabled: {
    label: 'Off',
    tone: 'neutral',
    detail: 'Enable External devices to allow new attachments and viewer sessions.'
  },
  not_configured: {
    label: 'Not configured',
    tone: 'neutral',
    detail: 'Configure the external ADB broker to use USB or TCP devices.'
  },
  broker_unavailable: {
    label: 'Unavailable',
    tone: 'warning',
    detail: 'Rebroid could not reach or authenticate with the external ADB broker.'
  }
} as const

export const CastingSettingsPageClient = ({
  initialHealth,
  containerId,
  initialSessions,
  applications,
  owners,
  externalEnabled = false,
  externalAvailability,
  loading = false
}: {
  loading?: boolean
  initialHealth: ServiceHealth
  containerId?: string
  initialSessions: DisplaySidecarSession[]
  applications: CastingApplication[]
  owners: Array<{ id: string; name: string }>
  externalEnabled?: boolean
  externalAvailability?: ExternalDeviceAvailability
}) => {
  const [refreshKey, setRefreshKey] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isRefreshingPage, startRefresh] = useTransition()
  const router = useRouter()
  const [refreshResult, setRefreshResult] = useState({ version: 0, succeeded: false })
  const completeRefresh = useCallback((succeeded: boolean) => {
    setIsRefreshing(false)
    setRefreshResult(previous => ({ version: previous.version + 1, succeeded }))
  }, [])
  const controller = useCastingSidecarController({
    initialHealth,
    initialSessions,
    externalEnabled,
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
  const broker = externalAvailability ? brokerStatus[externalAvailability.status] : null

  return (
    <ServiceDetailLayout
      title='Casting'
      navigation={{ section: { label: 'Administration' } }}
      health={controller.health}
      loading={loading}
      gridToolbar
      refresh={
        <PlatformPageRefreshButton
          refreshResult={refreshResult}
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
      {loading || broker ? (
        <Section
          surface='panel'
          title='External device broker'
          actions={
            loading ? undefined : (
              <ResourceLink
                href='/devices'
                className='inline-flex min-h-6 items-center text-xs'
              >
                External devices
              </ResourceLink>
            )
          }
        >
          {loading ? (
            <Skeleton className='h-5 w-40' />
          ) : broker ? (
            <div className='flex flex-wrap items-center gap-2 text-sm text-foreground-muted'>
              <StatusBadge tone={broker.tone}>{broker.label}</StatusBadge>
              <span>{broker.detail}</span>
            </div>
          ) : null}
        </Section>
      ) : null}
      {loading || controller.health.ok || externalAvailability?.enabled || controller.sessions.length > 0 ? (
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
