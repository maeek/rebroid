import type { ReactNode } from 'react'
import { IconCopy } from '@tabler/icons-react'
import { Visible } from '@/components/ui/visible'
import { cn } from '@/lib/utils'

type AppInfoRowProps = {
  label: string
  value: string | ReactNode
  copyValue?: string
  valueClassName?: string
}

export const AppInfoRow = ({ label, value, copyValue, valueClassName }: AppInfoRowProps) => {
  const handleCopy = () => {
    if (!copyValue) {
      return
    }

    void navigator.clipboard.writeText(copyValue)
  }

  return (
    <div className='group flex flex-col gap-2 border-b border-surface-border/50 py-3 last:border-b-0 sm:flex-row sm:items-start sm:justify-between sm:gap-6'>
      <div className='shrink-0 text-xs font-medium uppercase tracking-wide text-foreground-muted sm:w-36'>{label}</div>
      <div
        className={cn(
          'flex min-w-0 items-start gap-2 text-sm text-foreground sm:ml-auto sm:max-w-[70%] sm:justify-end sm:text-right',
          valueClassName
        )}
      >
        <Visible when={copyValue}>
          <button
            type='button'
            className='mt-0.5 shrink-0 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 hover:text-primary'
            onClick={handleCopy}
          >
            <IconCopy className='size-4' />
          </button>
        </Visible>
        <div className='min-w-0 break-all'>{value}</div>
      </div>
    </div>
  )
}
