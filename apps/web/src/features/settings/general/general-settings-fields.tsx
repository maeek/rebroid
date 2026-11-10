'use client'

import { useSyncExternalStore } from 'react'
import { useTheme } from 'next-themes'
import { FormField } from '@/components/ui/form-field'
import { NumberSliderField } from '@/components/ui/number-slider-field'
import { Section } from '@/components/ui/section'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { appThemeOptions } from '@/components/ui/theme-toggle'
import { viewerPlacementOptions } from '@/shared/model/settings/viewer-placement'
import { useViewerPlacement } from '@/shared/model/settings/viewer-placement-context'
import { AccentColorPicker } from '@/shared/ui/settings/accent-color-picker'
import { ViewerStreamingSliderFields } from '@/shared/ui/settings/viewer-streaming-slider-fields'
import type { GeneralUiSettings } from '@/shared/model/settings/orchestrator-ui-settings'
import type { AccentColor } from '@/shared/model/theme/accent-color'

export const AppearanceSettings = ({
  accentColor,
  onAccentColorChange,
  loading = false
}: {
  accentColor: AccentColor
  onAccentColorChange: (color: AccentColor) => void
  loading?: boolean
}) => (
  <div
    id='appearance'
    className='scroll-mt-[calc(var(--console-top-inset)+1rem)]'
  >
    <Section
      surface='plain'
      title='Appearance'
    >
      <div className='grid gap-4 sm:grid-cols-2'>
        <ThemeField loading={loading} />
        <ViewerPlacementField loading={loading} />
      </div>
      <AccentColorPicker
        value={accentColor}
        loading={loading}
        onChange={onAccentColorChange}
      />
    </Section>
  </div>
)

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
        <ViewerStreamingSliderFields
          loading={loading}
          values={{
            bitrateMbps: settings.defaultViewerBitrateMbps,
            maxFps: settings.defaultViewerMaxFps,
            iFrameInterval: settings.defaultViewerIFrameInterval
          }}
          onChange={patch =>
            onSettingsChange({
              defaultViewerBitrateMbps: patch.bitrateMbps ?? settings.defaultViewerBitrateMbps,
              defaultViewerMaxFps: patch.maxFps ?? settings.defaultViewerMaxFps,
              defaultViewerIFrameInterval: patch.iFrameInterval ?? settings.defaultViewerIFrameInterval
            })
          }
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

const subscribeToHydration = () => () => {}
const clientSnapshot = () => true
const serverSnapshot = () => false

const ThemeField = ({ loading }: { loading: boolean }) => {
  const { theme, setTheme } = useTheme()
  const hydrated = useSyncExternalStore(subscribeToHydration, clientSnapshot, serverSnapshot)
  return (
    <FormField
      label='Theme'
      description='Applies immediately in this browser.'
      layout='vertical'
    >
      <Select
        value={hydrated ? (theme ?? '') : ''}
        onValueChange={setTheme}
        disabled={loading || !hydrated}
      >
        <SelectTrigger className='w-full'>
          <SelectValue placeholder='Select theme' />
        </SelectTrigger>
        <SelectContent>
          {appThemeOptions.map(({ value, label }) => (
            <SelectItem
              key={value}
              value={value}
            >
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FormField>
  )
}

const ViewerPlacementField = ({ loading }: { loading: boolean }) => {
  const { placement, setPlacement } = useViewerPlacement()
  return (
    <FormField
      label='Viewer layout'
      description='Choose where the viewer appears on wide screens. On narrow screens it sits above the page content.'
      layout='vertical'
    >
      <Select
        value={placement}
        onValueChange={setPlacement}
        disabled={loading}
      >
        <SelectTrigger className='w-full'>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {viewerPlacementOptions.map(({ value, label }) => (
            <SelectItem
              key={value}
              value={value}
            >
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FormField>
  )
}
