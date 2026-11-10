import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { NumericUnitInput } from '@/components/ui/numeric-unit-input'
import { Section } from '@/components/ui/section'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { DetailFields } from '@/shared/ui/detail-fields'
import { ResourceLink } from '@/shared/ui/resource-link'
import { RuntimeImagePicker } from '@/shared/ui/runtime-image/runtime-image-picker'
import type { PlatformImage } from '@/shared/contracts/platform'
import type { OrchestratorUiSettings } from '@/shared/model/settings/orchestrator-ui-settings'

const numberValue = (value: number, fallback: number) => (Number.isFinite(value) ? value : fallback)

export const PlatformRuntimeFieldsSection = ({
  images,
  settings,
  onSettingsChange,
  loading = false,
  disabled = false
}: {
  images: PlatformImage[]
  settings: OrchestratorUiSettings
  onSettingsChange: (patch: Partial<OrchestratorUiSettings>) => void
  loading?: boolean
  disabled?: boolean
}) => (
  <div className='@container/runtime min-w-0'>
    <div className='grid min-w-0 items-stretch gap-6 @min-[48rem]/runtime:grid-cols-2 @min-[96rem]/runtime:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(16rem,0.75fr)]'>
      <Section
        surface='plain'
        title='Image defaults'
        description='Used when an app has no image override.'
        contentClassName='gap-4'
      >
        <FormField
          label='Default image'
          controlId='runtime-default-image'
          layout='vertical'
        >
          {loading ? (
            <Skeleton className='touch-control h-9 w-full' />
          ) : (
            <RuntimeImagePicker
              images={images}
              value={settings.defaultContainerImage}
              disabled={disabled}
              onChange={defaultContainerImage => onSettingsChange({ defaultContainerImage })}
            />
          )}
        </FormField>
        <FormField
          label='Image registry'
          controlId='runtime-image-registry'
          description='Optional prefix for image names without a registry host.'
          layout='vertical'
        >
          {loading ? (
            <Skeleton className='touch-control h-9 w-full' />
          ) : (
            <Input
              className='w-full'
              value={settings.dockerImageRegistry ?? ''}
              disabled={disabled}
              placeholder='registry.internal.example:5000'
              onChange={event => onSettingsChange({ dockerImageRegistry: event.target.value.trim() || null })}
            />
          )}
        </FormField>
      </Section>
      <Section
        surface='plain'
        title='App behavior'
        className='@container/behavior'
        description='Session behavior, APK uploads, and app data.'
        contentClassName='gap-6'
      >
        <div className='grid min-w-0 gap-4 @min-[30rem]/behavior:grid-cols-2'>
          <FormField
            label='Default inactivity timeout'
            controlId='runtime-inactivity-timeout'
            description='Stop inactive apps after this interval unless the app overrides it.'
            layout='vertical'
          >
            {loading ? (
              <Skeleton className='touch-control h-9 w-full max-w-48' />
            ) : (
              <NumericUnitInput
                unit='seconds'
                value={settings.defaultInactivityTimeoutSeconds}
                disabled={disabled}
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
            )}
          </FormField>
          <FormField
            label='Max APK size'
            controlId='runtime-max-apk-size'
            description='Maximum size for APK uploads across the platform.'
            layout='vertical'
          >
            {loading ? (
              <Skeleton className='touch-control h-9 w-full max-w-48' />
            ) : (
              <NumericUnitInput
                unit='MB'
                value={settings.maxApkUploadSizeMb}
                disabled={disabled}
                min={1}
                max={4096}
                type='number'
                onChange={event =>
                  onSettingsChange({
                    maxApkUploadSizeMb: numberValue(Number(event.target.value), settings.maxApkUploadSizeMb)
                  })
                }
              />
            )}
          </FormField>
        </div>
        <FormField
          layout='vertical'
          label='Remove app data on delete'
          controlId='runtime-remove-app-data'
          description='Also delete persistent storage and stored APK data when an app is removed.'
        >
          {loading ? (
            <Skeleton className='h-5 w-9' />
          ) : (
            <Switch
              checked={settings.removeDataOnDelete}
              disabled={disabled}
              onCheckedChange={removeDataOnDelete => onSettingsChange({ removeDataOnDelete })}
            />
          )}
        </FormField>
      </Section>
      <Section
        surface='plain'
        title='Connection'
        description='Managed by your deployment configuration.'
        className='@min-[48rem]/runtime:col-span-2 @min-[96rem]/runtime:col-span-1'
        contentClassName='grid gap-6 @min-[48rem]/runtime:grid-cols-2 @min-[96rem]/runtime:grid-cols-1'
      >
        <DetailFields
          loading={loading}
          fields={[
            {
              label: 'API URL',
              value: settings.orchestratorApiUrl,
              copyValue: settings.orchestratorApiUrl,
              code: true,
              fullWidth: true
            }
          ]}
        />
        <div className='grid gap-2 text-sm'>
          <ResourceLink href='/platform/services'>Manage service connections</ResourceLink>
        </div>
      </Section>
    </div>
  </div>
)
