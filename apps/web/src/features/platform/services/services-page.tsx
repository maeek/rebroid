'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { IconCast, IconListDetails, IconLoader2, IconPencil, IconRestore, IconSettings } from '@tabler/icons-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Section } from '@/components/ui/section'
import { StatusBadge, type StatusBadgeTone } from '@/components/ui/status-badge'
import { toast } from '@/hooks/use-toast'
import { useFeatureFlags } from '@/shared/model/features/feature-flags-context'
import {
  resetOrchestratorUiSettings,
  saveOrchestratorUiSettings
} from '@/shared/model/settings/use-orchestrator-ui-settings'
import { DataGrid } from '@/shared/ui/data-grid/data-grid'
import { DataGridWorkspace } from '@/shared/ui/data-grid/data-grid-workspace'
import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent, StandardPage } from '@/shared/ui/page/page-layout'
import { ServiceSettingsDialog, serviceDetails, serviceMeta, type ServiceId } from './service-settings-dialog'
import type { ServiceHealth } from '@/shared/contracts/diagnostics'
import type {
  OptionalServicesUiSettings,
  OrchestratorUiSettings
} from '@/shared/model/settings/orchestrator-ui-settings'
import type { ColumnDef } from '@tanstack/react-table'

type ServiceRow = {
  id: ServiceId | 'display'
  title: string
  description: string
  icon: ReactNode
  endpoint: string | null
  timeoutMs: number | null
  settingsSummary: string
  state: {
    label: string
    tone: StatusBadgeTone
  }
  action:
    | {
        type: 'edit'
        serviceId: ServiceId
      }
    | {
        type: 'link'
        href: string
        label: string
      }
}

const displayStatusTones = {
  healthy: 'success',
  unhealthy: 'danger',
  offline: 'danger',
  disabled: 'neutral'
} satisfies Record<ServiceHealth['status'], StatusBadgeTone>

const displayStatusLabels = {
  healthy: 'Healthy',
  unhealthy: 'Unhealthy',
  offline: 'Offline',
  disabled: 'Disabled'
} satisfies Record<ServiceHealth['status'], string>

const runtimeSettings = (settings: OrchestratorUiSettings) => ({
  defaultContainerImage: settings.defaultContainerImage,
  dockerImageRegistry: settings.dockerImageRegistry,
  defaultInactivityTimeoutSeconds: settings.defaultInactivityTimeoutSeconds,
  maxApkUploadSizeMb: settings.maxApkUploadSizeMb,
  services: settings.services
})

const serviceIds = Object.keys(serviceMeta) as ServiceId[]

const isServiceId = (value: string | null | undefined): value is ServiceId =>
  Boolean(value) && serviceIds.includes(value as ServiceId)

export const PlatformServicesPage = ({
  initialDisplayHealth,
  initialSettings,
  requestedServiceId
}: {
  initialDisplayHealth: ServiceHealth
  initialSettings: OrchestratorUiSettings
  requestedServiceId?: string | null
}) => {
  const pathname = usePathname()
  const router = useRouter()
  const [settings, setSettings] = useState(initialSettings)
  const [editingService, setEditingService] = useState<ServiceId | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [searchDraft, setSearchDraft] = useState('')
  const [search, setSearch] = useState('')
  const { isFeatureEnabled } = useFeatureFlags()

  const setServiceRoute = useCallback(
    (serviceId: ServiceId | null) => {
      router.replace(serviceId ? `${pathname}?service=${serviceId}` : pathname, { scroll: false })
    },
    [pathname, router]
  )

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

  const serviceRows = useMemo<ServiceRow[]>(() => {
    const configurableRows: ServiceRow[] = (Object.keys(serviceMeta) as ServiceId[])
      .filter(id => (id === 'ocr' ? isFeatureEnabled('feature.ocr') : isFeatureEnabled('feature.firewall')))
      .map(id => {
        const service = settings.services[id]
        const meta = serviceMeta[id]
        return {
          id,
          title: meta.title,
          description: meta.description,
          icon: meta.icon,
          endpoint: service.endpoint,
          timeoutMs: service.timeoutMs,
          settingsSummary: serviceDetails(settings.services, id),
          state: {
            label: service.endpoint ? 'Configured' : 'Needs endpoint',
            tone: service.endpoint ? 'success' : 'warning'
          },
          action: {
            type: 'edit',
            serviceId: id
          }
        }
      })

    return [
      ...configurableRows,
      {
        id: 'display',
        title: 'Display service',
        description: 'Live display streaming and viewer session management.',
        icon: <IconCast className='size-5' />,
        endpoint: 'Managed internally',
        timeoutMs: null,
        settingsSummary: 'Viewer session management',
        state: {
          label: displayStatusLabels[initialDisplayHealth.status],
          tone: displayStatusTones[initialDisplayHealth.status]
        },
        action: {
          type: 'link',
          href: '/platform/services/display-sessions',
          label: 'View sessions'
        }
      }
    ]
  }, [initialDisplayHealth.status, isFeatureEnabled, settings.services])

  const columns = useMemo<ColumnDef<ServiceRow>[]>(
    () => [
      {
        accessorKey: 'title',
        header: 'Service',
        meta: { label: 'Service' },
        size: 320,
        cell: ({ row }) => (
          <div className='flex min-w-0 items-center gap-3'>
            <div className='flex size-9 shrink-0 items-center justify-center rounded-control bg-primary/10 text-primary'>
              {row.original.icon}
            </div>
            <div className='min-w-0'>
              <div className='truncate font-medium text-foreground'>{row.original.title}</div>
              <div className='mt-1 truncate text-xs text-foreground-muted'>{row.original.description}</div>
            </div>
          </div>
        )
      },
      {
        id: 'state',
        header: 'State',
        meta: { label: 'State' },
        size: 132,
        cell: ({ row }) => <StatusBadge tone={row.original.state.tone}>{row.original.state.label}</StatusBadge>
      },
      {
        accessorKey: 'endpoint',
        header: 'Endpoint',
        meta: { label: 'Endpoint' },
        size: 360,
        cell: ({ row }) => (
          <span className='truncate text-foreground-muted'>{row.original.endpoint ?? 'Not configured'}</span>
        )
      },
      {
        accessorKey: 'timeoutMs',
        header: 'Timeout',
        meta: { label: 'Timeout' },
        size: 140,
        cell: ({ row }) => (
          <span className='whitespace-nowrap text-foreground-muted'>
            {row.original.timeoutMs === null ? '—' : `${row.original.timeoutMs} ms`}
          </span>
        )
      },
      {
        accessorKey: 'settingsSummary',
        header: 'Settings',
        meta: { label: 'Settings' },
        size: 320,
        cell: ({ row }) => <span className='truncate text-foreground-muted'>{row.original.settingsSummary}</span>
      },
      {
        id: 'actions',
        header: '',
        meta: { label: 'Actions' },
        enableSorting: false,
        enableResizing: false,
        size: 144,
        cell: ({ row }) => {
          const action = row.original.action
          return (
            <div className='flex justify-end'>
              {action.type === 'link' ? (
                <Button
                  asChild
                  variant='ghost'
                  size='sm'
                >
                  <Link href={action.href}>
                    <IconListDetails className='size-4' />
                    {action.label}
                  </Link>
                </Button>
              ) : (
                <Button
                  type='button'
                  variant='ghost'
                  size='sm'
                  onClick={() => openServiceEditor(action.serviceId)}
                >
                  <IconPencil className='size-4' />
                  Edit
                </Button>
              )}
            </div>
          )
        }
      }
    ],
    [openServiceEditor]
  )
  const visibleServiceRows = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return serviceRows
    return serviceRows.filter(service =>
      `${service.title} ${service.description} ${service.endpoint ?? ''} ${service.state.label} ${service.settingsSummary}`
        .toLowerCase()
        .includes(query)
    )
  }, [search, serviceRows])

  useEffect(() => {
    setSettings(initialSettings)
  }, [initialSettings])

  useEffect(() => {
    const enabled =
      requestedServiceId === 'ocr'
        ? isFeatureEnabled('feature.ocr')
        : requestedServiceId === 'firewall' && isFeatureEnabled('feature.firewall')
    setEditingService(enabled && isServiceId(requestedServiceId) ? requestedServiceId : null)
  }, [isFeatureEnabled, requestedServiceId])

  const updateServices = (services: OptionalServicesUiSettings) => {
    setSettings(current => ({
      ...current,
      services
    }))
  }

  const saveSettings = async () => {
    setIsSaving(true)
    try {
      const saved = await saveOrchestratorUiSettings(runtimeSettings(settings))
      setSettings(current => ({ ...saved, orchestratorApiUrl: current.orchestratorApiUrl }))
      toast({ title: 'Service settings saved' })
    } catch (error) {
      toast({
        title: 'Could not save service settings',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'danger'
      })
    } finally {
      setIsSaving(false)
    }
  }

  const resetSettings = async () => {
    setIsSaving(true)
    try {
      const saved = await resetOrchestratorUiSettings()
      setSettings(current => ({ ...saved, orchestratorApiUrl: current.orchestratorApiUrl }))
      toast({ title: 'Service settings reset' })
    } catch (error) {
      toast({
        title: 'Could not reset service settings',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'danger'
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <StandardPage className='gap-2'>
      <PageHeader
        section={{ label: 'Platform', href: '/platform' }}
        title='Services'
        description='Configure optional sidecar connection and runtime settings. Feature availability is managed separately.'
        actions={
          <>
            <Button
              type='button'
              variant='secondary'
              onClick={() => void resetSettings()}
              disabled={isSaving}
            >
              <IconRestore className='size-4' />
              Reset
            </Button>
            <Button
              type='button'
              onClick={() => void saveSettings()}
              disabled={isSaving}
            >
              {isSaving ? <IconLoader2 className='size-4 animate-spin' /> : <IconSettings className='size-4' />}
              Save
            </Button>
          </>
        }
      />
      <PageContent>
        <Section
          surface='plain'
          contentClassName='gap-4'
        >
          <DataGridWorkspace
            search={searchDraft}
            searchPlaceholder='Search services'
            onSearchChange={setSearchDraft}
            onSearch={setSearch}
          >
            <DataGrid
              columns={columns}
              data={visibleServiceRows}
              totalItems={visibleServiceRows.length}
              pageIndex={0}
              pageSize={Math.max(visibleServiceRows.length, 1)}
              getRowId={row => row.id}
              minWidth='78rem'
              emptyState={<div className='text-center text-foreground-muted'>No services match your search.</div>}
            />
          </DataGridWorkspace>
        </Section>
      </PageContent>
      <ServiceSettingsDialog
        serviceId={editingService}
        services={settings.services}
        onChange={updateServices}
        onClose={closeServiceEditor}
      />
    </StandardPage>
  )
}
