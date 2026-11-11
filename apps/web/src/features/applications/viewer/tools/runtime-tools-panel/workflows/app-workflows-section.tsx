'use client'

import { useEffect, useRef } from 'react'
import { IconArrowLeft } from '@tabler/icons-react'
import { useQueryClient } from '@tanstack/react-query'
import { usePathname, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { AppAutomationRunAction } from '@/features/applications/viewer/actions/app-automation-run-action'
import { AppWorkflowRunDetails, AppWorkflowRunDetailsLoading } from './app-workflow-run-details'
import { AppWorkflowRunHistory } from './app-workflow-run-history'

const noop = () => undefined

export function AppWorkflowsSection({ appId }: { appId: string }) {
  const pathname = usePathname()
  const search = useSearchParams()
  const runId = search.get('run')
  const queryClient = useQueryClient()
  const backRef = useRef<HTMLButtonElement>(null)
  const historyRef = useRef<HTMLDivElement>(null)
  const previousRunRef = useRef<string | null>(null)
  const endpoint = `/api/bff/applications/${encodeURIComponent(appId)}/workflow-runs`
  const href = (id: string | null) => {
    const query = new URLSearchParams(search)
    if (id) query.set('run', id)
    else query.delete('run')
    return `${pathname}?${query}`
  }
  const selectRun = (id: string | null) => window.history.pushState(null, '', href(id))

  useEffect(() => {
    const previousRun = previousRunRef.current
    previousRunRef.current = runId
    if (runId) backRef.current?.focus()
    else if (previousRun) {
      const link = Array.from(
        historyRef.current?.querySelectorAll<HTMLAnchorElement>('[data-workflow-run]') ?? []
      ).find(item => item.dataset.workflowRun === previousRun)
      ;(link ?? historyRef.current)?.focus()
    }
  }, [runId])

  return (
    <div className='grid min-w-0 gap-3'>
      <div
        ref={historyRef}
        tabIndex={-1}
        hidden={Boolean(runId)}
      >
        <AppWorkflowRunHistory
          endpoint={endpoint}
          enabled={!runId}
          href={href}
          onOpen={selectRun}
          launch={
            <AppAutomationRunAction
              onRunStarted={run => {
                selectRun(run.id)
                void queryClient.invalidateQueries({
                  queryKey: ['application-workflow-runs', endpoint],
                  refetchType: 'none'
                })
              }}
            />
          }
        />
      </div>
      {runId ? (
        <>
          <Button
            ref={backRef}
            variant='ghost'
            size='sm'
            className='-ml-2 justify-self-start px-2'
            onClick={() => selectRun(null)}
          >
            <IconArrowLeft />
            Run history
          </Button>
          <AppWorkflowRunDetails
            key={runId}
            endpoint={endpoint}
            runId={runId}
          />
        </>
      ) : null}
    </div>
  )
}

export function AppWorkflowsLoading() {
  const runId = useSearchParams().get('run')
  return runId ? (
    <div className='grid min-w-0 gap-3'>
      <Button
        variant='ghost'
        size='sm'
        className='-ml-2 justify-self-start px-2'
        disabled
      >
        <IconArrowLeft /> Run history
      </Button>
      <AppWorkflowRunDetailsLoading />
    </div>
  ) : (
    <AppWorkflowRunHistory
      loading
      href={() => '#'}
      onOpen={noop}
      launch={
        <Button
          variant='secondary'
          disabled
        >
          Run workflow
        </Button>
      }
    />
  )
}
