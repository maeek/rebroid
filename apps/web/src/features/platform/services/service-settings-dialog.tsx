'use client'

import { useEffect, useState } from 'react'
import { IconPlugConnected, IconSettings } from '@tabler/icons-react'
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
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { NumericUnitInput } from '@/components/ui/numeric-unit-input'
import { TabsList, TabsPanel, TabsRoot, TabsTrigger } from '@/components/ui/tabs'
import { useDialogPayload } from '@/hooks/use-dialog-payload'
import { serviceMeta, updateService, type ServiceId } from './service-definitions'
import type { OptionalServicesUiSettings } from '@/shared/model/settings/orchestrator-ui-settings'

type DialogTab = 'connection' | 'settings'

const numberValue = (value: number, fallback: number) => (Number.isFinite(value) ? value : fallback)

export const ServiceSettingsDialog = ({
  onChange,
  onClose,
  serviceId: currentServiceId,
  services
}: {
  onChange: (services: OptionalServicesUiSettings) => void
  onClose: () => void
  serviceId: ServiceId | null
  services: OptionalServicesUiSettings
}) => {
  const [tab, setTab] = useState<DialogTab>('connection')
  const { payload: serviceId, onOpenChangeComplete } = useDialogPayload(currentServiceId)

  useEffect(() => {
    if (currentServiceId) setTab('connection')
  }, [currentServiceId])

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
      open={currentServiceId !== null}
      onOpenChangeComplete={onOpenChangeComplete}
      onOpenChange={open => {
        if (!open) onClose()
      }}
    >
      <DialogContent
        data-editor-dialog=''
        className='sm:max-w-xl'
      >
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
              <TabsTrigger
                value='connection'
                icon={<IconPlugConnected className='size-3.5' />}
              >
                Connection
              </TabsTrigger>
              <TabsTrigger
                value='settings'
                icon={<IconSettings className='size-3.5' />}
              >
                Settings
              </TabsTrigger>
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
    <FormField
      layout='vertical'
      label='Endpoint'
      description={description}
    >
      <Input
        value={service.endpoint ?? ''}
        placeholder={placeholder}
        onChange={event => onChange({ endpoint: event.target.value.trim() || null })}
      />
    </FormField>
    <FormField
      layout='vertical'
      label='Timeout'
      description='Maximum request time before the service is treated as unavailable.'
    >
      <NumericUnitInput
        unit='ms'
        type='number'
        min={100}
        max={120000}
        value={service.timeoutMs}
        onChange={event => onChange({ timeoutMs: numberValue(Number(event.target.value), service.timeoutMs) })}
      />
    </FormField>
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
    <FormField
      layout='vertical'
      label='Max image size'
      description='Largest side fed to OCR after resize.'
    >
      <NumericUnitInput
        unit='px'
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
    </FormField>
    <FormField
      layout='vertical'
      label='Min confidence'
      description='Discard OCR boxes below this score.'
    >
      <NumericUnitInput
        unit='/ 1'
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
    </FormField>
    <FormField
      layout='vertical'
      label='Language'
      description='The PaddleOCR language/model selected for this deployment.'
    >
      <Input
        value={services.ocr.language}
        placeholder='en'
        onChange={event => onChange('ocr', { language: event.target.value })}
      />
    </FormField>
  </div>
)
