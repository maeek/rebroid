import { useEffect, useRef } from 'react'
import { IconCheck, IconCircle, IconLoader2 } from '@tabler/icons-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { gappsBuildPhases } from '../model/gapps-build'
import type { GappsBuildController } from '../hooks/use-gapps-build-controller'

export const GappsBuildProgress = ({ controller }: { controller: GappsBuildController }) => {
  const logRef = useRef<HTMLPreElement>(null)

  useEffect(() => {
    const logElement = logRef.current
    if (logElement) logElement.scrollTop = logElement.scrollHeight
  }, [controller.activeJob?.logTail])

  return (
    <aside className='min-w-0 lg:sticky lg:top-24 lg:self-start'>
      <div className='flex items-start justify-between gap-4 border-b border-surface-border/60 pb-5'>
        <div>
          <h2 className='text-base font-medium'>Build progress</h2>
          <p className='mt-1 text-sm text-foreground-muted'>
            {controller.activeJob
              ? (gappsBuildPhases[controller.currentPhaseIndex]?.label ?? controller.activeJob.status)
              : 'Progress and logs will appear here.'}
          </p>
        </div>
        {controller.isRunning ? (
          <Button
            size='sm'
            variant='ghost'
            onClick={() => void controller.cancelBuild()}
          >
            Cancel
          </Button>
        ) : null}
      </div>

      {controller.activeJob ? (
        <div className='grid gap-6 pt-6'>
          <div className='grid gap-3 sm:grid-cols-2'>
            {gappsBuildPhases.map((phase, index) => {
              const complete = controller.activeJob?.status === 'succeeded' || index < controller.currentPhaseIndex
              const current = index === controller.currentPhaseIndex && controller.isRunning
              return (
                <div
                  key={phase.id}
                  className='flex items-center gap-3 text-sm'
                >
                  {complete ? (
                    <IconCheck className='size-4 text-success' />
                  ) : current ? (
                    <IconLoader2 className='size-4 animate-spin text-primary' />
                  ) : (
                    <IconCircle className='size-4 text-foreground-muted/50' />
                  )}
                  <span className={cn(current ? 'font-medium text-foreground' : 'text-foreground-muted')}>
                    {phase.label}
                  </span>
                </div>
              )
            })}
          </div>

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
              className='h-72 overflow-y-auto overscroll-contain rounded-panel bg-black/25 p-4 font-mono text-xs leading-5 text-foreground-muted'
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
