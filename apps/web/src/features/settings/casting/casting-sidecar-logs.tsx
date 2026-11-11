'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { IconChevronDown, IconChevronUp, IconTerminal2 } from '@tabler/icons-react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import { MutationButton } from '@/components/ui/mutation-button'
import { Skeleton } from '@/components/ui/skeleton'
import { getBff } from '@/lib/http/bff'
import { ActionResultError } from '@/shared/actions/action-result'
import { StateView } from '@/shared/ui/state-view'
import type { DisplaySidecarLogTail } from '@/shared/contracts/diagnostics'

export const CastingSidecarLogs = ({ disabled, revision }: { disabled: boolean; revision: number }) => (
  <Dialog>
    <DialogTrigger asChild>
      <Button
        type='button'
        variant='outline'
        disabled={disabled}
      >
        <IconTerminal2 className='size-4' />
        View logs
      </Button>
    </DialogTrigger>
    <DialogContent className='max-w-full grid-cols-[minmax(0,1fr)] sm:max-w-[80vw]'>
      <DialogHeader className='pr-8'>
        <DialogTitle>Display sidecar logs</DialogTitle>
        <DialogDescription>Recent output from the display sidecar container.</DialogDescription>
      </DialogHeader>
      <CastingSidecarLogTail revision={revision} />
    </DialogContent>
  </Dialog>
)

const CastingSidecarLogTail = ({ revision }: { revision: number }) => {
  const [expanded, setExpanded] = useState(false)
  const outputId = useId()
  const viewport = useRef<HTMLPreElement>(null)
  const logs = useQuery({
    queryKey: ['display-sidecar-logs', revision, expanded],
    queryFn: ({ signal }) =>
      getBff<DisplaySidecarLogTail>(`/api/bff/platform/display-sidecar/logs?expanded=${expanded}`, signal),
    gcTime: 0,
    refetchOnWindowFocus: false,
    retry: false,
    placeholderData: keepPreviousData
  })
  const output = logs.data?.output

  useEffect(() => {
    const node = viewport.current
    if (node) node.scrollTop = node.scrollHeight
  }, [output, expanded])

  const loadingPreview = logs.isPending
  const exceedsReadLimit = logs.error instanceof ActionResultError && logs.error.failure.status === 413
  const canExpand = expanded || logs.data?.truncated || exceedsReadLimit

  return (
    <div className='flex min-w-0 flex-col gap-3'>
      {canExpand ? (
        <div className='flex justify-end'>
          <MutationButton
            type='button'
            variant='outline'
            size='sm'
            pending={logs.isFetching}
            pendingLabel='Loading logs…'
            aria-expanded={expanded}
            aria-controls={outputId}
            onClick={() => setExpanded(value => !value)}
          >
            {expanded ? <IconChevronUp className='size-4' /> : <IconChevronDown className='size-4' />}
            {expanded ? 'Show preview' : 'Show more logs'}
          </MutationButton>
        </div>
      ) : null}
      <div
        id={outputId}
        aria-busy={logs.isFetching || loadingPreview}
        className='min-w-0'
      >
        {loadingPreview ? (
          <Skeleton className='h-28 w-full rounded-control' />
        ) : logs.isError ? (
          <StateView
            scope='grid'
            kind='error'
            title='Could not load sidecar logs'
            description={logs.error.message}
            actions={[{ label: 'Try again', onClick: () => void logs.refetch() }]}
          />
        ) : output ? (
          <>
            <pre
              ref={viewport}
              role='region'
              aria-label='Display sidecar log output'
              // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- Allow keyboard scrolling.
              tabIndex={0}
              className='max-h-[min(36rem,60dvh)] min-w-0 overflow-auto rounded-control bg-background p-3 font-mono text-xs leading-5 whitespace-pre text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset'
            >
              {output}
            </pre>
            {logs.data?.truncated ? (
              <p className='mt-2 text-xs text-foreground-muted'>
                Showing up to {logs.data.lineLimit} of the newest lines. Earlier output is omitted.
              </p>
            ) : null}
          </>
        ) : (
          <p className='text-sm text-foreground-muted'>The display sidecar has no log output yet.</p>
        )}
      </div>
    </div>
  )
}
