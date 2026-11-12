'use client'

import { useMemo, useState, useTransition } from 'react'
import { IconCast, IconServer, IconBrandDocker } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { Notice } from '@/components/ui/notice'
import { dockerRuntimeHealth, serviceHealthState } from '@/shared/model/diagnostics/service-health'
import { useFeatureFlags } from '@/shared/model/features/feature-flags-context'
import { PlatformPageRefreshButton } from '@/shared/ui/actions/platform-page-refresh-button'
import { PageLoadFailure } from '@/shared/ui/page/page-load-failure'
import { serviceDetails, serviceMeta, visibleOptionalServiceIds } from './service-definitions'
import { ServicesGrid } from './services-grid'
import { ServicesPageLayout } from './services-page-layout'
import type { ServiceRow } from './service-row'
import type { OrchestratorHealth, ServiceContainerIds } from '@/shared/contracts/diagnostics'
import type { OrchestratorUiSettings } from '@/shared/model/settings/orchestrator-ui-settings'

export const PlatformServicesPage = ({
  initialHealth,
  initialSettings,
  containerIds,
  requestId
}: {
  initialHealth: OrchestratorHealth | null
  initialSettings: OrchestratorUiSettings
  containerIds?: ServiceContainerIds
  requestId?: string
}) => {
  const router = useRouter()
  const [refreshing, startRefresh] = useTransition()
  const unavailable = initialHealth?.services.orchestrator.ok !== true
  const [hasLoaded, setHasLoaded] = useState(!unavailable)
  if (!unavailable && !hasLoaded) setHasLoaded(true)
  const { getFeature } = useFeatureFlags()

  const serviceRows = useMemo<ServiceRow[]>(() => {
    const { services } = initialSettings
    const configurableRows: ServiceRow[] = visibleOptionalServiceIds(getFeature, initialHealth?.services).map(id => {
      const service = services[id]
      const meta = serviceMeta[id]
      return {
        id,
        title: meta.title,
        description: meta.description,
        icon: meta.icon,
        endpoint: service.endpoint,
        containerId: containerIds?.[id],
        timeoutMs: service.timeoutMs,
        settingsSummary: `${serviceDetails(services, id)} ${meta.featureKey}`,
        state: serviceHealthState(initialHealth?.services[id]),
        href: id === 'firewall' ? '/security/firewall' : '/platform/services?service=ocr'
      }
    })

    return [
      {
        id: 'orchestrator',
        title: 'Orchestrator',
        description: 'Application lifecycle and platform API.',
        icon: <IconServer className='size-5' />,
        endpoint: initialSettings.orchestratorApiUrl,
        containerId: containerIds?.orchestrator,
        timeoutMs: null,
        settingsSummary: 'Platform API',
        state: serviceHealthState(initialHealth?.services.orchestrator),
        href: '/platform/services?service=orchestrator'
      },
      {
        id: 'docker',
        title: 'Docker',
        description: 'Container engine, runtime, and operation diagnostics.',
        icon: <IconBrandDocker className='size-5' />,
        endpoint: 'Managed by deployment',
        timeoutMs: null,
        settingsSummary: 'Infrastructure diagnostics and operation limits',
        state: serviceHealthState(initialHealth ? dockerRuntimeHealth(initialHealth) : undefined),
        href: '/runtime/docker'
      },
      ...configurableRows,
      {
        id: 'display',
        title: 'Display service',
        description: 'Live streaming and viewer sessions.',
        icon: <IconCast className='size-5' />,
        endpoint: 'Managed internally',
        containerId: containerIds?.display,
        timeoutMs: null,
        settingsSummary: 'Viewer session management',
        state: serviceHealthState(initialHealth?.services.display),
        href: '/platform/casting'
      }
    ]
  }, [getFeature, initialHealth, initialSettings, containerIds])

  if (unavailable && !hasLoaded)
    return (
      <ServicesPageLayout>
        <PageLoadFailure
          title='Services unavailable'
          requestId={requestId}
          description='Service connections and health could not be loaded from the orchestrator.'
          backAction={{ label: 'Go to overview', href: '/platform' }}
        />
      </ServicesPageLayout>
    )

  return (
    <ServicesPageLayout
      breadcrumbRefresh={
        <PlatformPageRefreshButton
          isRefreshing={refreshing}
          onRefresh={() => startRefresh(() => router.refresh())}
        />
      }
    >
      {unavailable ? (
        <Notice
          tone='warning'
          title='Services could not be refreshed'
          description='Refresh to reconnect and load service health.'
        >
          {requestId ? <p className='text-xs text-foreground-muted'>Reference: {requestId}</p> : null}
        </Notice>
      ) : null}
      <ServicesGrid
        disabled={unavailable}
        rows={serviceRows}
        onActivate={service => router.push(service.href)}
      />
    </ServicesPageLayout>
  )
}
