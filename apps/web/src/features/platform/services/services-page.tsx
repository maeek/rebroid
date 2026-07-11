'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { IconLoader2, IconPencil, IconRestore, IconSettings } from '@tabler/icons-react'
import { usePathname, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Section } from '@/components/ui/section'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import {
  resetOrchestratorUiSettings,
  saveOrchestratorUiSettings
} from '@/shared/model/settings/use-orchestrator-ui-settings'
import { DataGrid } from '@/shared/ui/data-grid'
import { PageHeader } from '@/shared/ui/page/page-header'
import { StandardPage } from '@/shared/ui/page/page-layout'
import { ServiceSettingsDialog, serviceDetails, serviceMeta, type ServiceId } from './service-settings-dialog'
import type {
  OptionalServicesUiSettings,
  OrchestratorUiSettings
} from '@/shared/model/settings/orchestrator-ui-settings'
import type { ColumnDef } from '@tanstack/react-table'

type ServiceRow = {
  id: ServiceId
  title: string
  description: string
  icon: ReactNode
  enabled: boolean
  endpoint: string | null
  timeoutMs: number
  settingsSummary: string
}

const serviceStatus = (service: { enabled: boolean; endpoint: string | null }) => {
  if (!service.enabled) return 'Disabled'
  return service.endpoint ? 'Enabled' : 'Needs endpoint'
}

const statusClassName = (service: { enabled: boolean; endpoint: string | null }) => {
  if (!service.enabled) return 'border-surface-border/70 bg-surface-band/45 text-foreground-muted'
  return service.endpoint
    ? 'border-success/35 bg-success/10 text-success'
    : 'border-warning/35 bg-warning/10 text-warning'
}

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
  initialSettings,
  requestedServiceId
}: {
  initialSettings: OrchestratorUiSettings
  requestedServiceId?: string | null
}) => {
  const pathname = usePathname()
  const router = useRouter()
  const [settings, setSettings] = useState(initialSettings)
  const [editingService, setEditingService] = useState<ServiceId | null>(null)
  const [isSaving, setIsSaving] = useState(false)

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

  const serviceRows = useMemo<ServiceRow[]>(
    () =>
      (Object.keys(serviceMeta) as ServiceId[]).map(id => {
        const service = settings.services[id]
        const meta = serviceMeta[id]
        return {
          id,
          title: meta.title,
          description: meta.description,
          icon: meta.icon,
          enabled: service.enabled,
          endpoint: service.endpoint,
          timeoutMs: service.timeoutMs,
          settingsSummary: serviceDetails(settings.services, id)
        }
      }),
    [settings.services]
  )

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
        cell: ({ row }) => (
          <span
            className={cn(
              'inline-flex rounded-full border px-2 py-1 text-xs font-medium uppercase leading-none',
              statusClassName(row.original)
            )}
          >
            {serviceStatus(row.original)}
          </span>
        )
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
        cell: ({ row }) => <span className='whitespace-nowrap text-foreground-muted'>{row.original.timeoutMs} ms</span>
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
        size: 112,
        cell: ({ row }) => (
          <div className='flex justify-end'>
            <Button
              type='button'
              variant='ghost'
              size='sm'
              onClick={() => openServiceEditor(row.original.id)}
            >
              <IconPencil className='size-4' />
              Edit
            </Button>
          </div>
        )
      }
    ],
    [openServiceEditor]
  )

  useEffect(() => {
    setSettings(initialSettings)
  }, [initialSettings])

  useEffect(() => {
    setEditingService(isServiceId(requestedServiceId) ? requestedServiceId : null)
  }, [requestedServiceId])

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
        breadcrumbs={[{ label: 'Platform', href: '/platform' }, { label: 'Services' }]}
        title='Services'
        description='Configure optional sidecar services. Disabled services are ignored by automation and health checks.'
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
      <section className='px-6 pb-16 max-sm:px-4'>
        <Section
          surface='plain'
          contentClassName='gap-4'
        >
          <DataGrid
            columns={columns}
            data={serviceRows}
            totalItems={serviceRows.length}
            pageIndex={0}
            pageSize={Math.max(serviceRows.length, 1)}
            getRowId={row => row.id}
            minWidth='78rem'
            emptyState={<div className='text-center text-foreground-muted'>No optional services configured.</div>}
          />
        </Section>
      </section>
      <ServiceSettingsDialog
        serviceId={editingService}
        services={settings.services}
        onChange={updateServices}
        onClose={closeServiceEditor}
      />
    </StandardPage>
  )
}
