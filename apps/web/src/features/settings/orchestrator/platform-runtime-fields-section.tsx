import type { FormEventHandler } from 'react'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { NumericUnitInput } from '@/components/ui/numeric-unit-input'
import { Section } from '@/components/ui/section'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { RuntimeImagePicker } from '@/shared/ui/runtime-image/runtime-image-picker'
import { AndroidRenderingSection } from './android-rendering-section'
import type { PlatformImage } from '@/shared/contracts/platform'
import type { OrchestratorUiSettings } from '@/shared/model/settings/orchestrator-ui-settings'
import type { AndroidRenderingSettings } from '@rebroid/android-application-core/redroid-runtime'

const numberValue = (value: number, fallback: number) => (Number.isFinite(value) ? value : fallback)

export const PlatformRuntimeFieldsSection = ({
  images,
  settings,
  savedRenderingSettings = settings.androidRendering,
  appliedRenderingSettings,
  onSettingsChange,
  onSubmit,
  loading = false,
  disabled = false
}: {
  images: PlatformImage[]
  settings: OrchestratorUiSettings
  savedRenderingSettings?: AndroidRenderingSettings
  appliedRenderingSettings?: (AndroidRenderingSettings | null)[] | null
  onSettingsChange: (patch: Partial<OrchestratorUiSettings>) => void
  onSubmit?: FormEventHandler<HTMLFormElement>
  loading?: boolean
  disabled?: boolean
}) => (
  <div className='@container/runtime min-w-0'>
    <form
      id='runtime-defaults-form'
      aria-label='Runtime defaults'
      className='grid min-w-0 items-stretch gap-6 @min-[48rem]/runtime:grid-cols-2 @min-[96rem]/runtime:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(16rem,0.85fr)]'
      onSubmit={onSubmit}
    >
      <Section
        surface='plain'
        title='Image defaults'
        description='Used when an app has no image override.'
        contentClassName='gap-4'
      >
        <FormField
          label='Default image'
          controlId='runtime-default-image'
          description='Choose a local image or enter an image reference.'
          layout='vertical'
        >
          {loading ? (
            <Skeleton className='touch-control h-9 w-full' />
          ) : (
            <RuntimeImagePicker
              allowCustomReference
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
      <AndroidRenderingSection
        settings={settings.androidRendering}
        savedSettings={savedRenderingSettings}
        appliedSettings={appliedRenderingSettings}
        loading={loading}
        disabled={disabled}
        onChange={androidRendering => onSettingsChange({ androidRendering })}
      />
    </form>
  </div>
)
