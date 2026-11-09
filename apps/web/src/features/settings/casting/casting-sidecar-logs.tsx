'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { IconChevronDown, IconChevronUp } from '@tabler/icons-react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { MutationButton } from '@/components/ui/mutation-button'
import { Section } from '@/components/ui/section'
import { Skeleton } from '@/components/ui/skeleton'
import { getBff } from '@/lib/http/bff'
import { cn } from '@/lib/utils'
import { ActionResultError } from '@/shared/actions/action-result'
import { StateView } from '@/shared/ui/state-view'
import type { DisplaySidecarLogTail } from '@/shared/contracts/diagnostics'

export const CastingSidecarLogs = ({ loading, revision }: { loading: boolean; revision: number }) => {
  const [expanded, setExpanded] = useState(false)
  const outputId = useId()
  const viewport = useRef<HTMLPreElement>(null)
  const logs = useQuery({
    queryKey: ['display-sidecar-logs', revision, expanded],
    queryFn: ({ signal }) =>
      getBff<DisplaySidecarLogTail>(`/api/bff/platform/display-sidecar/logs?expanded=${expanded}`, signal),
    enabled: !loading,
    gcTime: 30_000,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    retry: false,
    placeholderData: keepPreviousData
  })
  const output = logs.data?.output

  useEffect(() => {
    const node = viewport.current
    if (node) node.scrollTop = node.scrollHeight
  }, [output, expanded])

  const loadingPreview = loading || (logs.isPending && !output)
  const exceedsReadLimit = logs.error instanceof ActionResultError && logs.error.failure.status === 413
  const canExpand = expanded || logs.data?.truncated || exceedsReadLimit

  return (
    <Section
      surface='panel'
      title='Recent logs'
      description='Newest output from the display sidecar container.'
      headingSpacing='compact'
      actions={
        canExpand || loadingPreview ? (
          <MutationButton
            type='button'
            variant='outline'
            size='sm'
            disabled={loadingPreview}
            pending={logs.isFetching && expanded}
            pendingLabel='Loading logs…'
            aria-expanded={expanded}
            aria-controls={outputId}
            onClick={() => setExpanded(value => !value)}
          >
            {expanded ? <IconChevronUp className='size-4' /> : <IconChevronDown className='size-4' />}
            {expanded ? 'Show preview' : 'Show more logs'}
          </MutationButton>
        ) : null
      }
    >
      <div
        id={outputId}
        aria-busy={logs.isFetching || loadingPreview}
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
              className={cn(
                'min-w-0 overflow-auto rounded-control bg-background p-3 font-mono text-xs leading-5 whitespace-pre text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                expanded ? 'max-h-[60dvh]' : 'max-h-56'
              )}
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
    </Section>
  )
}
