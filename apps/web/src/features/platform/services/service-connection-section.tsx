import { Fragment } from 'react'
import { FormField } from '@/components/ui/form-field'
import { FormLoadingBoundary } from '@/components/ui/form-loading-boundary'
import { Input } from '@/components/ui/input'
import { NumericUnitInput } from '@/components/ui/numeric-unit-input'
import { Section } from '@/components/ui/section'
import { serviceMeta, type ServiceId } from './service-definitions'
import type { OptionalServiceUiSettings } from '@/shared/model/settings/orchestrator-ui-settings'

export const ServiceConnectionSection = ({
  serviceId,
  settings,
  disabled,
  loading,
  errors,
  onChange
}: {
  serviceId: ServiceId
  settings: OptionalServiceUiSettings
  disabled: boolean
  loading: boolean
  errors?: Partial<Record<keyof OptionalServiceUiSettings, string[]>>
  onChange: (patch: Partial<OptionalServiceUiSettings>) => void
}) => {
  const FieldsBoundary = loading ? FormLoadingBoundary : Fragment
  const meta = serviceMeta[serviceId]
  return (
    <Section
      surface='panel'
      title='Connection'
    >
      <FieldsBoundary>
        <div className='grid gap-x-form-column gap-y-4 md:grid-cols-2'>
          <FormField
            layout='vertical'
            label='Endpoint'
            description={meta.endpointDescription}
            error={errors?.endpoint?.[0]}
          >
            <Input
              disabled={disabled}
              value={settings.endpoint ?? ''}
              placeholder={meta.endpointPlaceholder}
              onChange={event => onChange({ endpoint: event.target.value })}
            />
          </FormField>
          <FormField
            layout='vertical'
            label='Timeout'
            description='Maximum request time before the service is treated as unavailable.'
            error={errors?.timeoutMs && 'Enter a whole number from 100 to 120,000 ms.'}
          >
            <NumericUnitInput
              unit='ms'
              type='number'
              min={100}
              max={120000}
              disabled={disabled}
              value={Number.isNaN(settings.timeoutMs) ? '' : settings.timeoutMs}
              onChange={event => onChange({ timeoutMs: event.target.valueAsNumber })}
            />
          </FormField>
        </div>
      </FieldsBoundary>
    </Section>
  )
}
