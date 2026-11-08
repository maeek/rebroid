'use client'

import { FormField } from '@/components/ui/form-field'
import { NumberSliderField } from '@/components/ui/number-slider-field'
import type { ResourceLimitBounds } from '@/shared/contracts/system-resources'
import type { ResourceQuota } from '@/shared/permissions/permissions'

type QuotaKey = keyof ResourceQuota

type QuotaField = {
  key: QuotaKey
  label: string
  description: string
  suffix: string
  inputSuffix: string
  min: number
  max: number
  step?: number
}

const quotaFields: QuotaField[] = [
  {
    key: 'maxOpenApps',
    label: 'Max Open Apps',
    description: 'Maximum running or provisioning apps for the user.',
    suffix: ' apps',
    inputSuffix: 'apps',
    min: 1,
    max: 20
  },
  {
    key: 'maxSessionSeconds',
    label: 'Max Session Limit',
    description: 'Maximum inactivity timeout the user can request.',
    suffix: 's',
    inputSuffix: 'seconds',
    min: 60,
    max: 86400
  },
  {
    key: 'maxMemoryMb',
    label: 'Max RAM',
    description: 'Maximum per-container memory limit.',
    suffix: ' MB',
    inputSuffix: 'MB',
    min: 128,
    max: 65536
  },
  {
    key: 'maxCpuCpus',
    label: 'Max CPU',
    description: 'Maximum per-container CPU limit.',
    suffix: ' cores',
    inputSuffix: 'cores',
    min: 0.1,
    max: 64,
    step: 0.1
  }
]

const valueToInput = (value: number | null | undefined) => (value === null || value === undefined ? '' : String(value))

export const QuotaFields = ({
  quotas,
  resourceLimits,
  onChange
}: {
  quotas: Partial<ResourceQuota>
  resourceLimits?: ResourceLimitBounds | null
  onChange: (quotas: Partial<ResourceQuota>) => void
}) => {
  const setQuota = (key: QuotaKey, value: string) => {
    onChange({
      ...quotas,
      [key]: value.trim() === '' ? null : Number(value)
    })
  }

  const maxForField = (field: QuotaField) => {
    if (field.key === 'maxMemoryMb') {
      return resourceLimits?.maxMemoryMb ?? field.max
    }

    if (field.key === 'maxCpuCpus') {
      return resourceLimits?.maxCpuCpus ?? field.max
    }

    return field.max
  }

  return (
    <div className='grid gap-4 sm:grid-cols-2'>
      {quotaFields.map(field => (
        <FormField
          key={field.key}
          label={field.label}
          description={field.description}
          layout='vertical'
        >
          <NumberSliderField
            showSlider={false}
            value={valueToInput(quotas[field.key])}
            min={field.min}
            max={maxForField(field)}
            step={field.step}
            placeholder='Unlimited'
            suffix={field.suffix}
            inputSuffix={field.inputSuffix}
            allowEmpty
            clearLabel='Unlimited'
            onValueChange={value => setQuota(field.key, value)}
          />
        </FormField>
      ))}
    </div>
  )
}
