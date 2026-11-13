'use client'

import { FormField } from '@/components/ui/form-field'
import { NumberSliderField } from '@/components/ui/number-slider-field'
import { Section } from '@/components/ui/section'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { ViewerBitrateField } from '@/shared/ui/settings/viewer-bitrate-field'
import type { GeneralUiSettings } from '@/shared/model/settings/orchestrator-ui-settings'

export const ConsoleDefaultsFields = ({
  settings,
  onSettingsChange,
  loading = false
}: {
  settings: GeneralUiSettings
  onSettingsChange: (patch: Partial<GeneralUiSettings>) => void
  loading?: boolean
}) => (
  <>
    <Section
      surface='plain'
      orientation='vertical'
      title='Frontend defaults'
      headingSpacing='default'
    >
      <FormField
        label='List refresh interval'
        description='Controls how often app lists refresh automatically across the frontend.'
        layout='vertical'
      >
        <NumberSliderField
          loading={loading}
          showSlider={false}
          value={String(settings.appListRefreshIntervalSeconds)}
          min={2}
          max={120}
          inputSuffix='seconds'
          suffix='s'
          onValueChange={value =>
            onSettingsChange({
              appListRefreshIntervalSeconds: Number.isFinite(Number(value))
                ? Number(value)
                : settings.appListRefreshIntervalSeconds
            })
          }
        />
      </FormField>
    </Section>
    <Section
      surface='plain'
      orientation='vertical'
      title='Streaming defaults'
      description='Interactive video always requests the native display at 60 fps with a one-second IDR interval.'
      headingSpacing='default'
    >
      <div className='grid gap-4'>
        <FormField
          label='Preset'
          description='Default quality profile for new viewer sessions.'
          layout='vertical'
        >
          <Select
            value={settings.defaultViewerPreset}
            disabled={loading}
            onValueChange={value =>
              onSettingsChange({
                defaultViewerPreset:
                  value === 'low-latency' ||
                  value === 'balanced' ||
                  value === 'high-quality' ||
                  value === 'bandwidth-saver'
                    ? value
                    : 'balanced'
              })
            }
          >
            <SelectTrigger className='w-full'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='low-latency'>Low latency</SelectItem>
              <SelectItem value='balanced'>Balanced</SelectItem>
              <SelectItem value='high-quality'>High quality</SelectItem>
              <SelectItem value='bandwidth-saver'>Bandwidth saver</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
        <ViewerBitrateField
          loading={loading}
          value={String(settings.defaultViewerBitrateMbps)}
          onValueChange={value => onSettingsChange({ defaultViewerBitrateMbps: Number(value) })}
        />
      </div>
      <FormField
        label='Enable keyboard in fullscreen'
        description='Fullscreen viewer sessions start with keyboard input captured.'
        layout='vertical'
      >
        <Switch
          disabled={loading}
          checked={settings.defaultViewerKeyboardCaptureEnabled}
          onCheckedChange={checked => onSettingsChange({ defaultViewerKeyboardCaptureEnabled: checked })}
        />
      </FormField>
      <FormField
        label='Enable sound'
        description='Request audio when the viewer stream supports it.'
        layout='vertical'
      >
        <Switch
          disabled={loading}
          checked={settings.defaultViewerSoundEnabled}
          onCheckedChange={checked => onSettingsChange({ defaultViewerSoundEnabled: checked })}
        />
      </FormField>
    </Section>
  </>
)
