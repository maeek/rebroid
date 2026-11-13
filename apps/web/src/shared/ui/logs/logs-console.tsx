'use client'

import { ReactNode, useEffect, useMemo, useRef } from 'react'
import { IconCopy, IconLoader2, IconRefresh } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Visible } from '@/components/ui/visible'
import { toast } from '@/hooks/use-toast'
import { formatDateLocale } from '@/lib/format'
import { cn } from '@/lib/utils'
import { parseLogOutput } from './ansi-log-output'

type LogsConsoleEntry = {
  collectedAt: string
  output: string
}

export const LogsConsole = ({
  loading = false,
  controls,
  log,
  isRefreshing = false,
  onRefresh,
  refreshDisabled = false,
  emptyMessage,
  collectedAtPrefix = 'Collected',
  formatCollectedAt,
  className,
  outputClassName,
  followOutput = false,
  outputLabel = 'Log output',
  showCollectedAt = true
}: {
  loading?: boolean
  controls?: ReactNode
  log?: LogsConsoleEntry
  isRefreshing?: boolean
  onRefresh?: () => void
  refreshDisabled?: boolean
  emptyMessage: string
  collectedAtPrefix?: string
  formatCollectedAt?: (value: string) => string
  className?: string
  outputClassName?: string
  followOutput?: boolean
  outputLabel?: string
  showCollectedAt?: boolean
}) => {
  const output = log?.output || ''
  const parsedOutput = useMemo(() => parseLogOutput(output), [output])
  const outputRef = useRef<HTMLPreElement>(null)
  useEffect(() => {
    if (followOutput && outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight
  }, [followOutput, output])

  const copyOutput = async () => {
    if (!parsedOutput.text) {
      return
    }

    try {
      await navigator.clipboard.writeText(parsedOutput.text)
      toast({ title: 'Logs copied', variant: 'success' })
    } catch {
      toast({
        title: 'Could not copy logs',
        description: 'The browser did not allow clipboard access.',
        variant: 'danger'
      })
    }
  }

  return (
    <div className={cn('grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)_auto] gap-4', className)}>
      <div className='flex items-end justify-between gap-3 max-sm:flex-col max-sm:items-stretch'>
        <Visible when={controls}>
          <div className='min-w-0 flex-1'>{controls}</div>
        </Visible>
        <div className='ml-auto flex shrink-0 items-center gap-2'>
          <Button
            type='button'
            variant='ghost'
            disabled={loading || !parsedOutput.text}
            onClick={() => void copyOutput()}
          >
            <IconCopy className='size-4' />
            Copy
          </Button>
          {onRefresh ? (
            <Button
              type='button'
              variant='ghost'
              disabled={loading || refreshDisabled || isRefreshing}
              onClick={onRefresh}
            >
              {isRefreshing ? <IconLoader2 className='size-4 animate-spin' /> : <IconRefresh className='size-4' />}
              Refresh
            </Button>
          ) : null}
        </div>
      </div>
      <pre
        ref={outputRef}
        aria-label={outputLabel}
        tabIndex={loading ? undefined : 0}
        className={cn(
          'min-h-0 overflow-auto rounded-control border border-surface-border/45 bg-surface-band/55 p-4 font-mono text-xs leading-5 text-foreground-muted supports-[backdrop-filter]:bg-background/34',
          outputClassName
        )}
      >
        {loading ? (
          <Skeleton
            as='span'
            className='block h-4 w-96 max-w-full'
          />
        ) : parsedOutput.text ? (
          parsedOutput.content
        ) : (
          emptyMessage
        )}
      </pre>
      <Visible when={log && showCollectedAt}>
        <p className='text-xs text-foreground-muted'>
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
