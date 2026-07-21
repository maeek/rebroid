import type { ComponentProps } from 'react'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Section } from '@/components/ui/section'
import { Switch } from '@/components/ui/switch'
import { RuntimeImagePicker } from '@/shared/ui/runtime-image/runtime-image-picker'
import type { PlatformImage } from '@/shared/contracts/platform'
import type { OrchestratorUiSettings } from '@/shared/model/settings/orchestrator-ui-settings'

const fieldControlClassName = 'w-full'
const numberValue = (value: number, fallback: number) => (Number.isFinite(value) ? value : fallback)

const UnitInput = ({ unit, className, ...props }: ComponentProps<typeof Input> & { unit: string }) => (
  <div className={fieldControlClassName}>
    <div className='relative'>
      <Input
        {...props}
        className={`pr-24 ${className ?? ''}`}
      />
      <span className='pointer-events-none absolute inset-y-0 right-8 flex items-center text-sm text-foreground-muted'>
        {unit}
      </span>
    </div>
  </div>
)

export const PlatformRuntimeFieldsSection = ({
  images,
  settings,
  onSettingsChange
}: {
  images: PlatformImage[]
  settings: OrchestratorUiSettings
  onSettingsChange: (patch: Partial<OrchestratorUiSettings>) => void
}) => {
  return (
    <div className='flex min-w-0 flex-col gap-6'>
      <Section
        surface='plain'
        title='Runtime defaults'
        titleClassName='pb-4'
        contentClassName='gap-6'
      >
        <FormField
          label='API URL'
          description='Read-only base URL used by the Next.js server when proxying requests to the orchestrator.'
          layout='vertical'
        >
          <Input
            className={fieldControlClassName}
            value={settings.orchestratorApiUrl}
            readOnly
          />
        </FormField>
        <FormField
          label='Default image'
          description='Base container image used when creating a new app without an explicit image override.'
          layout='vertical'
        >
          <RuntimeImagePicker
            images={images}
            value={settings.defaultContainerImage}
            onChange={defaultContainerImage => onSettingsChange({ defaultContainerImage })}
          />
        </FormField>
        <FormField
          label='Image registry'
          description='Optional registry prefix for unqualified image names. Images with an explicit host are left unchanged.'
          layout='vertical'
        >
          <Input
            className={fieldControlClassName}
            value={settings.dockerImageRegistry ?? ''}
            placeholder='registry.internal.example:5000'
            onChange={event => onSettingsChange({ dockerImageRegistry: event.target.value.trim() || null })}
          />
        </FormField>
        <FormField
          label='Default inactivity timeout'
          description='New applications inherit this idle timeout before the orchestrator stops inactive instances.'
          layout='vertical'
        >
          <UnitInput
            unit='seconds'
            value={settings.defaultInactivityTimeoutSeconds}
            min={60}
            max={86400}
            type='number'
            onChange={event =>
              onSettingsChange({
                defaultInactivityTimeoutSeconds: numberValue(
                  Number(event.target.value),
                  settings.defaultInactivityTimeoutSeconds
                )
              })
            }
          />
        </FormField>
        <FormField
          label='Max APK size'
          description='Maximum APK upload size accepted by the orchestrator and mirrored into the frontend proxy limit.'
          layout='vertical'
        >
          <UnitInput
            unit='MB'
            value={settings.maxApkUploadSizeMb}
            min={1}
            max={4096}
            type='number'
            onChange={event =>
              onSettingsChange({
                maxApkUploadSizeMb: numberValue(Number(event.target.value), settings.maxApkUploadSizeMb)
              })
            }
          />
        </FormField>
        <FormField
          label='Remove app data on delete'
          description='Deleting an app also removes its persistent storage volume and stored APK data.'
          layout='horizontal'
          surface='band'
        >
          <Switch
            checked={settings.removeDataOnDelete}
            onCheckedChange={removeDataOnDelete => onSettingsChange({ removeDataOnDelete })}
          />
        </FormField>
      </Section>
    </div>
  )
}
