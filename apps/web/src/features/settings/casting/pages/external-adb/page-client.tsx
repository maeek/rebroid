'use client'

import { useCallback, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Notice } from '@/components/ui/notice'
import { Section } from '@/components/ui/section'
import { readExternalBrokerAvailabilityAction } from '@/server/orchestrator/external-devices/broker-actions'
import { PlatformPageRefreshButton } from '@/shared/ui/actions/platform-page-refresh-button'
import { DetailFields } from '@/shared/ui/detail-fields'
import { ServiceDetailLayout } from '@/shared/ui/platform/service-detail-layout'
import { ResourceLink } from '@/shared/ui/resource-link'
import { CastingSessionsSection } from '../../casting-sessions-section'
import { useCastingSidecarController } from '../../use-casting-sidecar-controller'
import { AllowedEndpointsSection } from './allowed-endpoints-section'
import type { CastingApplication } from '../../casting-sidecar-utils'
import type { DisplaySidecarSession, ServiceHealth } from '@/shared/contracts/diagnostics'
import type { ExternalDeviceAvailability, ExternalTcpPolicy } from '@/shared/contracts/external-device'

const brokerStatus = {
  available: {
    label: 'Available',
    detail: 'The broker is ready to verify external devices and serve their viewer sessions.'
  },
  feature_disabled: {
    label: 'External devices are off',
    detail: 'Turn on External devices in Feature management to allow enrollment and attachments.'
  },
  not_configured: {
    label: 'Broker not configured',
    detail: 'Configure the external ADB broker in the deployment to allow device connections.'
  },
  broker_unavailable: {
    label: 'Broker unavailable',
    detail: 'Rebroid could not reach or authenticate with the external ADB broker.'
  }
} satisfies Record<ExternalDeviceAvailability['status'], { label: string; detail: string }>

const usbStatus = { configured: 'Available', not_configured: 'Not configured', unavailable: 'USB mount unavailable' }

const asHealth = (availability?: ExternalDeviceAvailability): ServiceHealth => ({
  ok: availability?.enabled === true,
  status: availability?.enabled ? 'healthy' : 'offline',
  message: availability ? brokerStatus[availability.status].detail : '',
  details: {
    usb: availability?.usb ? usbStatus[availability.usb] : 'Unknown',
    statusLabel: availability ? brokerStatus[availability.status].label : ''
  }
})

const readHealth = async () => asHealth(await readExternalBrokerAvailabilityAction())
const noApplications: CastingApplication[] = []

export const ExternalAdbPageClient = ({
  availability,
  policy,
  owners,
  sessions,
  loading = false
}: {
  availability?: ExternalDeviceAvailability
  policy?: ExternalTcpPolicy
  owners: Array<{ id: string; name: string }>
  sessions: DisplaySidecarSession[] | null
  loading?: boolean
}) => {
  const router = useRouter()
  const [refreshKey, setRefreshKey] = useState(0)
  const [refreshingPage, startRefresh] = useTransition()
  const [refreshResult, setRefreshResult] = useState({ version: 0, succeeded: false })
  const onRefreshComplete = useCallback((succeeded: boolean) => {
    setRefreshResult(previous => ({ version: previous.version + 1, succeeded }))
  }, [])
  const controller = useCastingSidecarController({
    initialHealth: asHealth(availability),
    initialSessions: sessions ?? [],
    applications: noApplications,
    provider: 'external',
    readHealth,
    refreshKey,
    onRefreshComplete
  })
  const { usb, statusLabel } = controller.health.details ?? {}
  const brokerLabel = typeof statusLabel === 'string' ? statusLabel : undefined

  return (
    <ServiceDetailLayout
      title='External ADB'
      navigation={{ section: { label: 'Administration' } }}
      health={controller.health}
      healthNotice={{
        title: brokerLabel,
        description: controller.health.message
      }}
      loading={loading}
      gridToolbar
      refresh={
        <PlatformPageRefreshButton
          refreshResult={refreshResult}
          disabled={loading}
          isRefreshing={refreshingPage || controller.busy === 'refresh'}
          onRefresh={() => {
            setRefreshKey(current => current + 1)
            startRefresh(() => router.refresh())
          }}
        />
      }
    >
      <Section
        surface='panel'
        title='External device broker'
        description='Handles device verification and viewer sessions for phones and Android VMs.'
        actions={
          !loading && controller.health.ok ? (
            <ResourceLink
              href='/devices'
              className='text-xs'
            >
              Devices
            </ResourceLink>
          ) : undefined
        }
      >
        <DetailFields
          loading={loading}
          fields={[
            { label: 'Broker status', value: brokerLabel },
            { label: 'USB enrollment', value: typeof usb === 'string' ? usb : 'Unknown' }
          ]}
        />
      </Section>
      <AllowedEndpointsSection
        key={policy?.revision}
        initialPolicy={policy}
      />
      {!loading && sessions === null && !controller.sessions.length ? (
        <Notice
          tone='warning'
          title='Viewer sessions unavailable'
          description='Refresh to retry reading sessions from the broker.'
        />
      ) : null}
      {loading || controller.health.ok || controller.sessions.length ? (
        <CastingSessionsSection
          loading={loading}
          controller={controller}
          applications={noApplications}
          owners={owners}
          emptyDescription='Open a verified external device in the viewer to start a session.'
        />
      ) : null}
    </ServiceDetailLayout>
  )
}

export const ExternalAdbPageLoading = () => (
  <ExternalAdbPageClient
    loading
    owners={[]}
    sessions={[]}
  />
)
