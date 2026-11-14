import { FormField } from '@/components/ui/form-field'
import { NumberSliderField } from '@/components/ui/number-slider-field'
import type { FieldPath } from '@/components/ui/field-changes'

export const ViewerBitrateField = ({
  field,
  value,
  onValueChange,
  loading = false
}: {
  field?: FieldPath
  value: string
  onValueChange: (value: string) => void
  loading?: boolean
}) => (
  <FormField
    field={field}
    layout='vertical'
    label='Bitrate'
    description='Stream bitrate in Mbps.'
  >
    <NumberSliderField
      loading={loading}
      value={value}
      min={1}
      max={32}
      step={0.5}
      suffix=' Mbps'
      rangeLabel='Bitrate range'
      onValueChange={onValueChange}
    />
  </FormField>
)
