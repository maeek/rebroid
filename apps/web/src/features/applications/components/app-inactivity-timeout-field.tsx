import { FormField } from '@/components/ui/form-field'
import { NumberSliderField } from '@/components/ui/number-slider-field'
import { lifecycleFieldClassName } from './app-form-utils'

export const AppInactivityTimeoutField = ({
  values,
  modified,
  onChange,
  timeoutError,
  disabled
}: {
  values: { inactivityTimeoutSeconds: number }
  modified?: Partial<Record<'inactivityTimeoutSeconds', boolean>>
  onChange: (patch: Partial<{ inactivityTimeoutSeconds: number }>) => void
  timeoutError?: string
  disabled?: boolean
}) => (
  <FormField
    label='Inactivity timeout'
    modified={modified?.inactivityTimeoutSeconds}
    error={timeoutError}
    description='Idle seconds. Use -1 to keep running.'
    layout='vertical'
    className={lifecycleFieldClassName}
    controlOwnsLoading
  >
    <NumberSliderField
      layout='side-by-side'
      showSlider={false}
      clampOnBlur={false}
      name='inactivityTimeoutSeconds'
      disabled={disabled}
      value={String(values.inactivityTimeoutSeconds)}
      min={-1}
      max={86400}
      inputSuffix='sec'
      onValueChange={value => onChange({ inactivityTimeoutSeconds: Number(value) })}
    />
  </FormField>
)
