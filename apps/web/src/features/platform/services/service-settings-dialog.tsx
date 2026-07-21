'use client'

import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { IconShield, IconSparkles } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TabsList, TabsPanel, TabsRoot, TabsTrigger } from '@/components/ui/tabs'
import type { OptionalServicesUiSettings } from '@/shared/model/settings/orchestrator-ui-settings'

export type ServiceId = keyof OptionalServicesUiSettings
type DialogTab = 'connection' | 'settings'

export const serviceMeta: Record<
  ServiceId,
  {
    title: string
    description: string
    icon: ReactNode
    endpointPlaceholder: string
    endpointDescription: string
    hasSettings: boolean
  }
> = {
  ocr: {
    title: 'OCR perception',
    description: 'PaddleOCR screenshot text extraction for AI perception.',
    icon: <IconSparkles className='size-5' />,
    endpointPlaceholder: 'http://ocr-sidecar:4300',
    endpointDescription: 'Base HTTP URL for the OCR sidecar.',
    hasSettings: true
  },
  firewall: {
    title: 'Firewall agent',
    description: 'Host-side firewall reconciler for network-access policies.',
    icon: <IconShield className='size-5' />,
    endpointPlaceholder: '/run/rebroid-firewall/agent.sock',
    endpointDescription: 'Unix socket path or HTTP(S) base URL for the firewall agent.',
    hasSettings: false
  }
}

export const serviceDetails = (services: OptionalServicesUiSettings, id: ServiceId) => {
  if (id === 'ocr') {
    const ocr = services.ocr
    return `${ocr.language} · quality-gated cascade · min ${ocr.minConfidence}`
  }

  return 'Network policy reconciliation'
}

export const updateService = <T extends ServiceId>(
  services: OptionalServicesUiSettings,
  id: T,
  patch: Partial<OptionalServicesUiSettings[T]>
): OptionalServicesUiSettings => ({
  ...services,
  [id]: {
    ...services[id],
    ...patch
  }
})

const numberValue = (value: number, fallback: number) => (Number.isFinite(value) ? value : fallback)

export const ServiceSettingsDialog = ({
  onChange,
  onClose,
  serviceId,
  services
}: {
  onChange: (services: OptionalServicesUiSettings) => void
  onClose: () => void
  serviceId: ServiceId | null
  services: OptionalServicesUiSettings
}) => {
  const [tab, setTab] = useState<DialogTab>('connection')

  useEffect(() => {
    if (serviceId) setTab('connection')
  }, [serviceId])

  if (!serviceId) {
    return (
      <Dialog
        open={false}
        onOpenChange={() => undefined}
      />
    )
  }

  const meta = serviceMeta[serviceId]
  const service = services[serviceId]
  const patch = <T extends ServiceId>(id: T, value: Partial<OptionalServicesUiSettings[T]>) => {
    onChange(updateService(services, id, value))
  }

  return (
    <Dialog
      open
      onOpenChange={open => {
        if (!open) onClose()
      }}
    >
      <DialogContent className='sm:max-w-xl'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            {meta.icon}
            {meta.title}
          </DialogTitle>
          <DialogDescription>{meta.description}</DialogDescription>
        </DialogHeader>
        {meta.hasSettings ? (
          <TabsRoot
            value={tab}
            onValueChange={value => setTab(value as DialogTab)}
          >
            <TabsList ariaLabel='Service settings sections'>
              <TabsTrigger value='connection'>Connection</TabsTrigger>
              <TabsTrigger value='settings'>Settings</TabsTrigger>
            </TabsList>
            <TabsPanel
              value='connection'
              className='min-h-[14.5rem] pt-4'
            >
              <ConnectionTab
                description={meta.endpointDescription}
                placeholder={meta.endpointPlaceholder}
                service={service}
                onChange={value => patch(serviceId, value)}
              />
            </TabsPanel>
            <TabsPanel
              value='settings'
              className='min-h-[14.5rem] pt-4'
            >
              <OcrSettingsTab
                services={services}
                onChange={patch}
              />
            </TabsPanel>
          </TabsRoot>
        ) : (
          <div className='min-h-[14.5rem]'>
            <ConnectionTab
              description={meta.endpointDescription}
              placeholder={meta.endpointPlaceholder}
              service={service}
              onChange={value => patch(serviceId, value)}
            />
          </div>
        )}
        <DialogFooter>
          <DialogClose asChild>
            <Button type='button'>Done</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const Field = ({ children, description, label }: { children: ReactNode; description: string; label: string }) => (
  <div className='grid gap-2'>
    <div className='grid gap-1'>
      <Label>{label}</Label>
      <p className='text-xs text-foreground-muted'>{description}</p>
    </div>
    {children}
  </div>
)

const ConnectionTab = ({
  description,
  onChange,
  placeholder,
  service
}: {
  description: string
  onChange: (value: Partial<OptionalServicesUiSettings[ServiceId]>) => void
  placeholder: string
  service: OptionalServicesUiSettings[ServiceId]
}) => (
  <div className='grid gap-4'>
    <Field
      label='Endpoint'
      description={description}
    >
      <Input
        value={service.endpoint ?? ''}
        placeholder={placeholder}
        onChange={event => onChange({ endpoint: event.target.value.trim() || null })}
      />
    </Field>
    <Field
      label='Timeout'
      description='Maximum request time before the service is treated as unavailable.'
    >
      <Input
        type='number'
        min={100}
        max={120000}
        value={service.timeoutMs}
        onChange={event => onChange({ timeoutMs: numberValue(Number(event.target.value), service.timeoutMs) })}
      />
    </Field>
  </div>
)

const OcrSettingsTab = ({
  onChange,
  services
}: {
  onChange: <T extends ServiceId>(id: T, value: Partial<OptionalServicesUiSettings[T]>) => void
  services: OptionalServicesUiSettings
}) => (
  <div className='grid gap-4'>
    <Field
      label='Max image size'
      description='Largest side fed to OCR after resize.'
    >
      <Input
        type='number'
        min={320}
        max={4096}
        value={services.ocr.maxImageDimension}
        onChange={event =>
          onChange('ocr', {
            maxImageDimension: numberValue(Number(event.target.value), services.ocr.maxImageDimension)
          })
        }
      />
    </Field>
    <Field
      label='Min confidence'
      description='Discard OCR boxes below this score.'
    >
      <Input
        type='number'
        min={0}
        max={1}
        step={0.05}
        value={services.ocr.minConfidence}
        onChange={event =>
          onChange('ocr', {
            minConfidence: numberValue(Number(event.target.value), services.ocr.minConfidence)
          })
        }
      />
    </Field>
    <Field
      label='Language'
      description='The PaddleOCR language/model selected for this deployment.'
    >
      <Input
        value={services.ocr.language}
        placeholder='en'
        onChange={event => onChange('ocr', { language: event.target.value })}
      />
    </Field>
  </div>
)
