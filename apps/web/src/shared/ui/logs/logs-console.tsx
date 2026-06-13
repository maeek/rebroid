'use client'

import { ReactNode } from 'react'
import { IconCopy, IconLoader2, IconRefresh } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Visible } from '@/components/ui/visible'
import { toast } from '@/hooks/use-toast'
import { formatDateLocale } from '@/lib/format'
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
}) => {
  const output = log?.output || ''

  const copyOutput = async () => {
    if (!output) {
      return
    }

    try {
      await navigator.clipboard.writeText(output)
      toast({ title: 'Logs copied' })
    } catch {
      toast({
        title: 'Could not copy logs',
        description: 'The browser did not allow clipboard access.',
        variant: 'destructive'
      })
    }
  }

  return (
    <div className={cn('grid min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] gap-4', className)}>
      <div className='flex items-center justify-between gap-3 max-sm:flex-col max-sm:items-stretch'>
        <Visible when={controls}>
          <div className='min-w-0 flex-1'>{controls}</div>
        </Visible>
        <div className='flex shrink-0 items-center gap-2'>
          <Button
            type='button'
            variant='ghost'
            disabled={!output}
            onClick={() => void copyOutput()}
          >
            <IconCopy className='size-4' />
            Copy
          </Button>
          <Button
            type='button'
            variant='ghost'
            disabled={refreshDisabled || isRefreshing}
            onClick={onRefresh}
          >
            {isRefreshing ? <IconLoader2 className='size-4 animate-spin' /> : <IconRefresh className='size-4' />}
            Refresh
          </Button>
        </div>
      </div>
      <pre
        className={cn(
          'min-h-0 overflow-auto rounded-md border border-border/45 bg-surface-band/55 p-4 font-mono text-xs leading-5 text-foreground-muted supports-[backdrop-filter]:bg-background/34',
          outputClassName
        )}
      >
        {output || emptyMessage}
      </pre>
      <Visible when={log}>
        <p className='text-xs text-muted-foreground'>
          {collectedAtPrefix}{' '}
          {log?.collectedAt
            ? formatCollectedAt
              ? formatCollectedAt(log.collectedAt)
              : formatDateLocale(log.collectedAt)
            : ''}
        </p>
      </Visible>
    </div>
  )
}
