import type { ReactNode } from 'react'
import { formatDateLocale } from '@/lib/format'

export const formatPlatformDate = (value: string | null | undefined) => {
  if (!value) {
    return 'unknown'
  }

  return formatDateLocale(value)
}

export const formatPlatformBytes = (bytes: number) => {
  if (!bytes) {
    return '0 B'
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / 1024 ** index).toFixed(2)} ${units[index]}`
}

export const PlatformDetailRow = ({ label, value }: { label: string; value: ReactNode }) => (
  <div className='grid min-w-0 content-start gap-1 py-1 text-sm'>
    <div className='text-xs font-medium text-foreground-muted'>{label}</div>
    <div className='min-w-0 break-all leading-5 text-foreground'>{value ?? 'none'}</div>
  </div>
)
