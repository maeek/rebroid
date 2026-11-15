import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'

export const AppInactivityTimeoutField = ({
  values,
  modified,
  onChange,
  timeoutError
}: {
  values: { inactivityTimeoutSeconds: number }
  modified?: Partial<Record<'inactivityTimeoutSeconds', boolean>>
  onChange: (patch: Partial<{ inactivityTimeoutSeconds: number }>) => void
  timeoutError?: string
}) => (
  <FormField
    label='Inactivity timeout'
    modified={modified?.inactivityTimeoutSeconds}
    error={timeoutError}
    description='Idle seconds. Use -1 to keep running.'
    layout='vertical'
  >
    <Input
      className='max-w-48'
      name='inactivityTimeoutSeconds'
      value={values.inactivityTimeoutSeconds}
      min={-1}
      max={86400}
      type='number'
      onChange={event => onChange({ inactivityTimeoutSeconds: Number(event.target.value) })}
    />
  </FormField>
)
