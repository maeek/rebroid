'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { IconCast, IconServer, IconBrandDocker } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { Notice } from '@/components/ui/notice'
import { toast } from '@/hooks/use-toast'
import { dockerRuntimeHealth } from '@/shared/model/diagnostics/service-health'
import { useFeatureFlags } from '@/shared/model/features/feature-flags-context'
import { saveOrchestratorUiSettings } from '@/shared/model/settings/use-orchestrator-ui-settings'
import { PlatformPageRefreshButton } from '@/shared/ui/actions/platform-page-refresh-button'
import { PageLoadFailure } from '@/shared/ui/page/page-load-failure'
import { serviceDetails, serviceIds, serviceMeta, isServiceId, type ServiceId } from './service-definitions'
import { serviceHealthState } from './service-health-state'
import { ServiceSettingsDialog } from './service-settings-dialog'
import { ServicesGrid } from './services-grid'
import { ServicesPageActions, ServicesSaveStatus } from './services-page-actions'
import { ServicesPageLayout } from './services-page-layout'
import type { ServiceRow } from './service-row'
import type { OrchestratorHealth } from '@/shared/contracts/diagnostics'
import type {
  OptionalServicesUiSettings,
  OrchestratorUiSettings
} from '@/shared/model/settings/orchestrator-ui-settings'

export const PlatformServicesPage = ({
  initialHealth,
  initialSettings,
  requestedServiceId,
  requestId
}: {
  initialHealth: OrchestratorHealth | null
  initialSettings: OrchestratorUiSettings
  requestedServiceId?: string | null
  requestId?: string
}) => {
  const router = useRouter()
  const [refreshing, startRefresh] = useTransition()
  const unavailable = initialHealth?.services.orchestrator.ok !== true
  const [hasLoaded, setHasLoaded] = useState(!unavailable)
  if (!unavailable && !hasLoaded) setHasLoaded(true)
  const [form, setForm] = useState({ services: initialSettings.services, savedServices: initialSettings.services })
  const { services, savedServices } = form
  const initialSettingsSnapshot = useRef(JSON.stringify(initialSettings.services))
  const [editingService, setEditingService] = useState<ServiceId | null>(null)
  const [pendingAction, setPendingAction] = useState<'save' | null>(null)
  const { isFeatureEnabled } = useFeatureFlags()

  const setServiceRoute = useCallback((serviceId: ServiceId | null) => {
    const url = new URL(window.location.href)
    if (serviceId) url.searchParams.set('service', serviceId)
    else url.searchParams.delete('service')
    // Dialog selection is local state; server navigation remounts the inventory.
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
  }, [])

  const openServiceEditor = useCallback(
    (serviceId: ServiceId) => {
      setEditingService(serviceId)
      setServiceRoute(serviceId)
    },
    [setServiceRoute]
  )

  const closeServiceEditor = useCallback(() => {
    setEditingService(null)
    setServiceRoute(null)
  }, [setServiceRoute])

  const activateService = useCallback(
    (service: ServiceRow) => {
      if (service.action.type === 'link') {
        router.push(service.action.href)
        return
      }
      openServiceEditor(service.action.serviceId)
    },
    [openServiceEditor, router]
  )

  const serviceRows = useMemo<ServiceRow[]>(() => {
    const configurableRows: ServiceRow[] = serviceIds.map(id => {
      const service = services[id]
      const meta = serviceMeta[id]
      const featureKey = meta.featureKey
      const enabled = isFeatureEnabled(featureKey)
      return {
        id,
        title: meta.title,
        description: meta.description,
        icon: meta.icon,
        endpoint: service.endpoint,
        timeoutMs: service.timeoutMs,
        settingsSummary: `${serviceDetails(services, id)} ${enabled ? 'enabled' : 'disabled'} ${featureKey}`,
        state: serviceHealthState(initialHealth?.services[id]),
        action: enabled
          ? { type: 'edit', serviceId: id }
          : {
              type: 'link',
              href: `/platform/features#${featureKey}`,
              label: 'Manage feature'
            }
      }
    })

    return [
      {
        id: 'orchestrator',
        title: 'Orchestrator',
        description: 'Application lifecycle and platform API.',
        icon: <IconServer className='size-5' />,
        endpoint: initialSettings.orchestratorApiUrl,
        timeoutMs: null,
        settingsSummary: 'Platform API',
        state: serviceHealthState(initialHealth?.services.orchestrator),
        action: { type: 'link', href: '/platform/services?service=orchestrator', label: 'View details' }
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
        action: { type: 'link', href: '/platform/services?service=docker', label: 'View diagnostics' }
      },
      ...configurableRows,
      {
        id: 'display',
        title: 'Display service',
        description: 'Live streaming and viewer sessions.',
        icon: <IconCast className='size-5' />,
        endpoint: 'Managed internally',
        timeoutMs: null,
        settingsSummary: 'Viewer session management',
        state: serviceHealthState(initialHealth?.services.display),
        action: {
          type: 'link',
          href: '/platform/services/display-sessions',
          label: 'View sessions'
        }
      }
    ]
  }, [initialHealth, initialSettings.orchestratorApiUrl, isFeatureEnabled, services])

  const hasConfiguration = serviceRows.some(service => service.action.type === 'edit')
  const hasChanges = JSON.stringify(services) !== JSON.stringify(savedServices)

  useEffect(() => {
    if (unavailable) return
    const snapshot = JSON.stringify(initialSettings.services)
    // Identical settings from a refresh must not overwrite the current draft.
    if (initialSettingsSnapshot.current === snapshot) return
    initialSettingsSnapshot.current = snapshot
    setForm(current => ({
      services:
        JSON.stringify(current.services) === JSON.stringify(current.savedServices)
          ? initialSettings.services
          : current.services,
      savedServices: initialSettings.services
    }))
  }, [initialSettings, unavailable])

  useEffect(() => {
    setEditingService(isServiceId(requestedServiceId) ? requestedServiceId : null)
  }, [requestedServiceId])

  const allowedEditingService =
    editingService && isFeatureEnabled(serviceMeta[editingService].featureKey) ? editingService : null

  const updateServices = (nextServices: OptionalServicesUiSettings) => {
    setForm(current => ({ ...current, services: nextServices }))
  }

  const saveSettings = async () => {
    if (pendingAction || !hasChanges || unavailable) return
    setPendingAction('save')
    try {
      const saved = await saveOrchestratorUiSettings({ services })
      setForm({ services: saved.services, savedServices: saved.services })
      startRefresh(() => router.refresh())
      toast({ title: 'Service settings saved', variant: 'success' })
    } catch (error) {
      toast({
        title: 'Could not save service settings',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'danger'
      })
    } finally {
      setPendingAction(null)
    }
  }

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
      actions={
        !unavailable && (hasConfiguration || hasChanges) ? (
          <ServicesPageActions
            hasChanges={hasChanges}
            saving={pendingAction === 'save'}
            onDiscard={() => setForm(current => ({ ...current, services: current.savedServices }))}
            onSave={() => void saveSettings()}
          />
        ) : undefined
      }
      meta={hasConfiguration || hasChanges ? <ServicesSaveStatus hasChanges={hasChanges} /> : undefined}
    >
      {unavailable ? (
        <Notice
          tone='warning'
          title='Services could not be refreshed'
          description='Your connection draft is kept. Refresh to reconnect before making changes.'
        >
          {requestId ? <p className='text-xs text-foreground-muted'>Reference: {requestId}</p> : null}
        </Notice>
      ) : null}
      <ServicesGrid
        disabled={pendingAction !== null || unavailable}
        rows={serviceRows}
        onEdit={openServiceEditor}
        onActivate={activateService}
      />
      <ServiceSettingsDialog
        serviceId={unavailable ? null : allowedEditingService}
        services={services}
        onChange={updateServices}
        onClose={closeServiceEditor}
      />
    </ServicesPageLayout>
  )
}
