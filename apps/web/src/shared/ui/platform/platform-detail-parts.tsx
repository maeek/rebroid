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
  <div className='grid grid-cols-[11rem_minmax(0,1fr)] gap-4 border-b border-surface-border/50 py-3 text-sm last:border-b-0 max-sm:grid-cols-1 max-sm:gap-1'>
    <div className='font-medium uppercase text-foreground-muted'>{label}</div>
    <div className='min-w-0 break-all text-right text-foreground-muted max-sm:text-left'>{value ?? 'none'}</div>
  </div>
)

export const PlatformJsonBlock = ({ value }: { value: unknown }) => (
  <pre className='max-h-[28rem] overflow-auto rounded-panel border border-surface-border/60 bg-surface-band/55 p-4 font-mono text-xs leading-6 text-foreground-muted'>
    {JSON.stringify(value, null, 2)}
  </pre>
)
