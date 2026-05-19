'use client'

import { Input } from '@/components/ui/input'
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
    <div className='grid gap-5'>
      {quotaFields.map(field => (
        <div
          key={field.key}
          className='grid gap-3'
        >
          <div className='grid gap-1'>
            <div className='font-bold text-sm text-foreground'>{field.label}</div>
            <div className='text-xs leading-relaxed text-muted-foreground'>{field.description}</div>
          </div>
          <div className='flex w-full items-center gap-3'>
            <Input
              className='min-w-0 basis-[78%] flex-none sm:basis-[calc(100%-6.5rem)]'
              value={valueToInput(quotas[field.key])}
              type='number'
              min={field.key === 'maxCpuCpus' ? 0.1 : 1}
              step={field.key === 'maxCpuCpus' ? 0.1 : 1}
              placeholder='Unlimited'
              onChange={event => setQuota(field.key, event.target.value)}
            />
            <span className='basis-[22%] whitespace-nowrap text-sm text-secondary-foreground sm:basis-20'>
              {field.suffix}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
