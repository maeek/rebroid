import type { ComponentType, ReactNode } from 'react'
import { NumberSliderField } from '@/components/ui/number-slider-field'

export type ViewerStreamingSliderValues = {
  bitrateMbps: number
  maxFps: number
  iFrameInterval: number
}

type ViewerStreamingSliderKey = keyof ViewerStreamingSliderValues

type ViewerStreamingSliderFieldDefinition = {
  key: ViewerStreamingSliderKey
  label: string
  description: string
  min: number
  max: number
  step?: number
  suffix: string
  rangeLabel: string
}

const viewerStreamingSliderFields: ViewerStreamingSliderFieldDefinition[] = [
  {
    key: 'bitrateMbps',
    label: 'Bitrate',
    description: 'Stream bitrate in Mbps.',
    min: 1,
    max: 32,
    step: 0.5,
    suffix: ' Mbps',
    rangeLabel: 'Bitrate range'
  }
]

const DefaultSetting = ({
  label,
  description: _description,
  children
}: {
  label: string
  description: string
  children: ReactNode
}) => (
  <label className='grid min-w-0 gap-2'>
    <span className='text-xs font-medium uppercase tracking-wide text-foreground-muted'>{label}</span>
    {children}
  </label>
)

export const ViewerStreamingSliderFields = ({
  values,
  onChange,
  SettingComponent = DefaultSetting
}: {
  values: ViewerStreamingSliderValues
  onChange: (patch: Partial<ViewerStreamingSliderValues>) => void
  SettingComponent?: ComponentType<{ label: string; description: string; children: ReactNode }>
}) => (
  <>
    {viewerStreamingSliderFields.map(field => (
      <SettingComponent
        key={field.key}
        label={field.label}
        description={field.description}
      >
        <NumberSliderField
          value={String(values[field.key])}
          min={field.min}
          max={field.max}
          step={field.step}
          suffix={field.suffix}
          rangeLabel={field.rangeLabel}
          onValueChange={value => onChange({ [field.key]: Number(value) })}
        />
      </SettingComponent>
    ))}
  </>
)
