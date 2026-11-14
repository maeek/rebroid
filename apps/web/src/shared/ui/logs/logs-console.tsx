'use client'

import { ReactNode, useMemo } from 'react'
import { IconArrowDown, IconLoader2, IconRefresh } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { CopyButton } from '@/components/ui/copy-button'
import { Skeleton } from '@/components/ui/skeleton'
import { Visible } from '@/components/ui/visible'
import { useFollowOutput } from '@/hooks/use-follow-output'
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
  const { outputRef, onScroll, isAtBottom, scrollToLatest } = useFollowOutput<HTMLPreElement>(output, followOutput)

  return (
    <div className={cn('grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)_auto] gap-4', className)}>
      <div className='flex items-end justify-between gap-3 max-sm:flex-col max-sm:items-stretch'>
        <Visible when={controls}>
          <div className='min-w-0 flex-1'>{controls}</div>
        </Visible>
        <div className='ml-auto flex shrink-0 items-center gap-2'>
          <CopyButton
            size='md'
            value={parsedOutput.text}
            disabled={loading || !parsedOutput.text}
          />
          {onRefresh ? (
            <Button
              type='button'
              variant='ghost'
              disabled={loading || refreshDisabled || isRefreshing}
              onClick={onRefresh}
            >
              {isRefreshing ? (
                <IconLoader2 className='size-4 motion-safe:animate-spin' />
              ) : (
                <IconRefresh className='size-4' />
              )}
              Refresh
            </Button>
          ) : null}
        </div>
      </div>
      <div className='relative grid min-h-0 min-w-0'>
        <pre
          ref={outputRef}
          onScroll={onScroll}
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
        {!loading && !isAtBottom ? (
          <div className='pointer-events-none absolute inset-x-0 bottom-3 flex justify-center'>
            <Button
              size='sm'
              variant='secondary'
              className='pointer-events-auto shadow-panel'
              onClick={() => {
                scrollToLatest()
                outputRef.current?.focus({ preventScroll: true })
              }}
            >
              <IconArrowDown
                aria-hidden
                className='size-4'
              />{' '}
              Latest output
            </Button>
          </div>
        ) : null}
      </div>
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
