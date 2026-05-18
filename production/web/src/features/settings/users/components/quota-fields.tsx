'use client'

import { Input } from '@/components/ui/input'
import { Setting } from '@/features/settings/components/setting'
import type { ResourceQuota } from '@/shared/permissions/permissions'

type QuotaKey = keyof ResourceQuota

const quotaFields: Array<{ key: QuotaKey; label: string; description: string; suffix: string }> = [
  {
    key: 'maxOpenApps',
    label: 'Max Open Apps',
    description: 'Maximum running or provisioning apps for the user.',
    suffix: 'apps'
  },
  {
    key: 'maxSessionSeconds',
    label: 'Max Session Limit',
    description: 'Maximum inactivity timeout the user can request.',
    suffix: 'seconds'
  },
  {
    key: 'maxMemoryMb',
    label: 'Max RAM',
    description: 'Maximum per-container memory limit.',
    suffix: 'MB'
  },
  {
    key: 'maxCpuCpus',
    label: 'Max CPU',
    description: 'Maximum per-container CPU limit.',
    suffix: 'cores'
  },
  {
    key: 'maxVolumeSizeMb',
    label: 'Max Volume',
    description: 'Maximum requested volume size.',
    suffix: 'MB'
  }
]

const valueToInput = (value: number | null | undefined) => (value === null || value === undefined ? '' : String(value))

export const QuotaFields = ({
  quotas,
  onChange
}: {
  quotas: Partial<ResourceQuota>
  onChange: (quotas: Partial<ResourceQuota>) => void
}) => {
  const setQuota = (key: QuotaKey, value: string) => {
    onChange({
      ...quotas,
      [key]: value.trim() === '' ? null : Number(value)
    })
  }

  return (
    <div className='grid gap-4 md:grid-cols-2'>
      {quotaFields.map(field => (
        <Setting
          key={field.key}
          label={field.label}
          description={field.description}
          className='flex-col items-start'
          variant='vertical'
        >
          <div className='flex w-full items-center gap-2'>
            <Input
              value={valueToInput(quotas[field.key])}
              type='number'
              min={field.key === 'maxCpuCpus' ? 0.1 : 1}
              step={field.key === 'maxCpuCpus' ? 0.1 : 1}
              placeholder='Unlimited'
              onChange={event => setQuota(field.key, event.target.value)}
            />
            <span className='min-w-16 text-sm text-secondary-foreground'>{field.suffix}</span>
          </div>
        </Setting>
      ))}
    </div>
  )
}
