'use client'

import { ReactNode } from 'react'
import { IconRefresh } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Visible } from '@/components/ui/visible'
import { cn } from '@/lib/utils'

type LogsConsoleEntry = {
  collectedAt: string
  output: string
}

export const LogsConsole = ({
  controls,
  log,
  isRefreshing = false,
  onRefresh,
  refreshDisabled = false,
  emptyMessage,
  collectedAtPrefix = 'Collected',
  formatCollectedAt,
  className,
  outputClassName
}: {
  controls?: ReactNode
  log?: LogsConsoleEntry
  isRefreshing?: boolean
  onRefresh: () => void
  refreshDisabled?: boolean
  emptyMessage: string
  collectedAtPrefix?: string
  formatCollectedAt?: (value: string) => string
  className?: string
  outputClassName?: string
}) => (
  <div className={cn('grid min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] gap-4', className)}>
    <div className='flex items-center justify-between gap-3 max-sm:flex-col max-sm:items-stretch'>
      <Visible when={controls}>
        <div className='min-w-0 flex-1'>{controls}</div>
      </Visible>
      <Button
        type='button'
        variant='secondary'
        disabled={refreshDisabled || isRefreshing}
        onClick={onRefresh}
      >
        <IconRefresh className={cn('size-4', { 'animate-spin': isRefreshing })} />
        Refresh
      </Button>
    </div>
    <pre
      className={cn(
        'min-h-0 overflow-auto rounded-md border border-border/60 bg-background/65 p-4 font-mono text-xs leading-5 text-secondary-foreground',
        outputClassName
      )}
    >
      {log?.output || emptyMessage}
    </pre>
    <Visible when={log}>
      <p className='text-xs text-muted-foreground'>
        {collectedAtPrefix}{' '}
        {log?.collectedAt
          ? formatCollectedAt
            ? formatCollectedAt(log.collectedAt)
            : new Date(log.collectedAt).toLocaleString()
          : ''}
      </p>
    </Visible>
  </div>
)
