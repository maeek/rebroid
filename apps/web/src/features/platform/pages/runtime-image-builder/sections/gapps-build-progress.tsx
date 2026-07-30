import { useEffect, useRef } from 'react'
import { IconCheck, IconCircle, IconLoader2 } from '@tabler/icons-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { MutationButton } from '@/components/ui/mutation-button'
import { cn } from '@/lib/utils'
import { gappsBuildPhases } from '../model/gapps-build'
import type { GappsBuildController } from '../hooks/use-gapps-build-controller'

const PhaseMarker = ({ complete, current }: { complete: boolean; current: boolean }) => {
  if (complete) return <IconCheck className='size-4 text-success' />
  if (current) {
    return (
      <IconLoader2
        data-testid='active-phase-spinner'
        className='size-4 animate-spin text-primary'
      />
    )
  }
  return <IconCircle className='size-4 text-foreground-muted/50' />
}

export const GappsBuildProgress = ({ controller }: { controller: GappsBuildController }) => {
  const logRef = useRef<HTMLPreElement>(null)
  const phaseIndex = Math.max(0, controller.currentPhaseIndex)
  const stepNumber = Math.min(phaseIndex + 1, gappsBuildPhases.length)

  useEffect(() => {
    const logElement = logRef.current
    if (logElement) logElement.scrollTop = logElement.scrollHeight
  }, [controller.activeJob?.logTail])

  return (
    <aside className='min-w-0 lg:sticky lg:top-24 lg:self-start'>
      <div className='flex items-start justify-between gap-4 border-b border-surface-border/60 pb-5'>
        <div>
          <h2 className='flex items-center gap-2 text-base font-medium'>
            Build progress
            {controller.isRunning ? (
              <IconLoader2
                className='size-4 animate-spin text-primary'
                aria-hidden='true'
              />
            ) : null}
          </h2>
          <p className='mt-1 text-sm text-foreground-muted'>
            {controller.activeJob
              ? (gappsBuildPhases[controller.currentPhaseIndex]?.label ?? controller.activeJob.status)
              : 'Progress and logs will appear here.'}
          </p>
        </div>
        {controller.isRunning ? (
          <MutationButton
            size='sm'
            variant='ghost'
            pending={controller.isCancelling}
            pendingLabel='Cancelling…'
            onClick={() => void controller.cancelBuild()}
          >
            Cancel
          </MutationButton>
        ) : null}
      </div>

      {controller.activeJob ? (
        <div className='grid gap-6 pt-6'>
          <div className='grid gap-3'>
            <div className='grid gap-2'>
              <div className='flex items-center justify-between gap-3 text-xs text-foreground-muted'>
                <span>
                  Step {stepNumber} of {gappsBuildPhases.length}
                </span>
                <span>{Math.round((stepNumber / gappsBuildPhases.length) * 100)}%</span>
              </div>
              <div
                className='h-1.5 overflow-hidden rounded-full bg-surface-band'
                role='progressbar'
                aria-label='Build phase progress'
                aria-valuemin={1}
                aria-valuemax={gappsBuildPhases.length}
                aria-valuenow={stepNumber}
              >
                <div
                  className='h-full rounded-full bg-primary transition-[width]'
                  style={{ width: `${(stepNumber / gappsBuildPhases.length) * 100}%` }}
                />
              </div>
            </div>
          </div>

          <ol className='grid gap-1'>
            {gappsBuildPhases.map((phase, index) => {
              const complete = controller.activeJob?.status === 'succeeded' || index < controller.currentPhaseIndex
              const current = index === controller.currentPhaseIndex && controller.isRunning
              return (
                <li
                  key={phase.id}
                  data-testid={current ? 'active-build-phase' : undefined}
                  aria-current={current ? 'step' : undefined}
                  className={cn(
                    'grid grid-cols-[1rem_minmax(0,1fr)] items-center gap-3 border-l border-surface-border/55 py-2 pl-4 text-sm',
                    current && 'border-l-2 border-primary bg-primary/6'
                  )}
                >
                  <PhaseMarker
                    complete={complete}
                    current={current}
                  />
                  <span className={cn(current ? 'font-medium text-foreground' : 'text-foreground-muted')}>
                    {phase.label}
                  </span>
                </li>
              )
            })}
          </ol>

          {controller.activeJob.error ? (
            <div className='border-l-2 border-danger pl-4 text-sm text-danger'>{controller.activeJob.error}</div>
          ) : null}

          <div>
            <div className='mb-2 flex items-center justify-between gap-3'>
              <h3 className='text-sm font-medium'>Build logs</h3>
              {controller.isRunning ? (
                <span className='text-xs text-foreground-muted'>Following latest output</span>
              ) : null}
            </div>
            <pre
              ref={logRef}
              data-testid='build-log'
              className='h-72 max-w-full min-w-0 overflow-auto overscroll-contain whitespace-pre rounded-panel bg-black/25 p-4 font-mono text-xs leading-5 text-foreground-muted'
              aria-live='polite'
            >
              {controller.activeJob.logTail || 'Waiting for output…'}
            </pre>
          </div>

          {controller.activeJob.status === 'succeeded' ? (
            <div className='flex flex-wrap gap-2'>
              <Button
                variant='outline'
                onClick={() => void controller.setAsDefault()}
              >
                Use as default
              </Button>
              <Button asChild>
                <Link href={controller.createAppHref}>Create app</Link>
              </Button>
            </div>
          ) : null}
        </div>
      ) : (
        <div className='py-12 text-sm text-foreground-muted'>Configure the image, then start the build.</div>
      )}
    </aside>
  )
}
