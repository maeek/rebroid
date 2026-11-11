import { isDrmRenderDevice, type AndroidRenderingSettings } from '@rebroid/android-application-core/redroid-runtime'
import { FormField } from '@/components/ui/form-field'
import { FormLoadingBoundary } from '@/components/ui/form-loading-boundary'
import { Input } from '@/components/ui/input'
import { Section } from '@/components/ui/section'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { renderDeviceError } from '@/shared/contracts/android-rendering-settings'

export const AndroidRenderingSection = ({
  settings,
  savedSettings,
  appliedSettings,
  loading,
  disabled,
  onChange
}: {
  settings: AndroidRenderingSettings
  savedSettings: AndroidRenderingSettings
  appliedSettings?: (AndroidRenderingSettings | null)[] | null
  loading: boolean
  disabled: boolean
  onChange: (settings: AndroidRenderingSettings) => void
}) => {
  const unknown = appliedSettings?.filter(setting => !setting).length ?? 0
  const different =
    appliedSettings?.filter(
      setting =>
        setting &&
        (setting.mode !== savedSettings.mode ||
          (savedSettings.mode === 'host' && setting.renderDevice !== savedSettings.renderDevice))
    ).length ?? 0

  const fields = (
    <div className='grid gap-4'>
      <FormField
        label='Rendering mode'
        controlId='runtime-rendering-mode'
        layout='vertical'
      >
        <Select
          value={settings.mode}
          disabled={disabled || loading}
          onValueChange={(mode: AndroidRenderingSettings['mode']) =>
            onChange({
              mode,
              renderDevice: isDrmRenderDevice(settings.renderDevice)
                ? settings.renderDevice
                : savedSettings.renderDevice
            })
          }
        >
          <SelectTrigger className='w-full'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='software'>Software (default)</SelectItem>
            <SelectItem value='host'>Host GPU</SelectItem>
          </SelectContent>
        </Select>
      </FormField>
      {settings.mode === 'host' ? (
        <FormField
          label='GPU render device'
          controlId='runtime-gpu-render-device'
          description='DRM render node on the Linux host running Docker.'
          error={!loading && !isDrmRenderDevice(settings.renderDevice) ? renderDeviceError : undefined}
          layout='vertical'
          required
        >
          <Input
            value={settings.renderDevice ?? ''}
            placeholder='/dev/dri/renderD128'
            autoComplete='off'
            spellCheck={false}
            disabled={disabled || loading}
            required
            onChange={event => onChange({ mode: 'host', renderDevice: event.target.value || null })}
          />
        </FormField>
      ) : null}
    </div>
  )

  return (
    <Section
      surface='plain'
      title='Hardware Acceleration'
      description='Choose how Redroid renders Android apps.'
      className='@min-[48rem]/runtime:col-span-2 @min-[96rem]/runtime:col-span-1'
      contentClassName='gap-4'
    >
      {loading ? <FormLoadingBoundary>{fields}</FormLoadingBoundary> : fields}
      <div className='grid gap-2 text-sm text-foreground-muted'>
        <p>
          Stop and start existing Redroid apps to apply changes. Persistent profiles are kept. Replacing a container can
          clear temporary data.
        </p>
        {appliedSettings?.length ? (
          <p>
            Of the existing Redroid runtimes, {different} differ from the saved setting and {unknown} have no recorded
            configuration.
          </p>
        ) : null}
        {!loading && savedSettings.mode === 'host' ? <p>Hardware rendering is unverified.</p> : null}
        <a
          className='w-fit text-primary underline'
          href='https://github.com/maeek/rebroid/blob/main/docs/deployment.md#android-gpu-rendering-on-linux'
        >
          GPU rendering setup
        </a>
      </div>
    </Section>
  )
}
