import { IconCheck, IconCircle, IconLoader2 } from '@tabler/icons-react'
import { StateTransition } from '@/components/ui/state-transition'
import { cn } from '@/lib/utils'
import { gappsBuildPhases } from '../model/gapps-build'
import { BuildLogs } from '../ui/build-logs'
import { BuildRunPanel } from '../ui/build-run-panel'
import type { GappsBuildController } from '../hooks/use-gapps-build-controller'

export const GappsBuildProgress = ({
  controller,
  loading = false
}: {
  controller: Pick<
    GappsBuildController,
    | 'activeJob'
    | 'isRunning'
    | 'isCancelling'
    | 'currentPhaseIndex'
    | 'cancelBuild'
    | 'setAsDefault'
    | 'createAppHref'
    | 'isSettingDefault'
  >
  loading?: boolean
}) => {
  const phaseIndex = controller.currentPhaseIndex
  return (
    <aside className='grid min-w-0 gap-6'>
      <BuildRunPanel
        job={controller.activeJob}
        running={controller.isRunning}
        cancelling={controller.isCancelling}
        settingDefault={controller.isSettingDefault}
        onCancel={() => void controller.cancelBuild()}
        onSetAsDefault={() => void controller.setAsDefault()}
        createAppHref={controller.createAppHref}
        loading={loading}
      >
        <p className='text-sm text-foreground-muted'>
          Step {Math.max(1, phaseIndex + 1)} of {gappsBuildPhases.length}. Phase order does not represent elapsed time.
        </p>
        <ol className='grid gap-1 sm:grid-cols-2'>
          {gappsBuildPhases.map((phase, index) => {
            const complete = controller.activeJob?.status === 'succeeded' || index < phaseIndex
            const current = index === phaseIndex && controller.isRunning
            let marker = <IconCircle className='size-4 text-foreground-muted/50' />
            if (complete) marker = <IconCheck className='size-4 text-success' />
            if (current)
              marker = (
                <IconLoader2
                  data-testid='active-phase-spinner'
                  className='size-4 motion-safe:animate-spin text-primary'
                />
              )
            return (
              <li
                key={phase.id}
                data-testid={current ? 'active-build-phase' : undefined}
                aria-current={current ? 'step' : undefined}
                className={cn(
                  'flex items-center gap-3 rounded-control px-2 py-2 text-sm text-foreground-muted',
                  current && 'bg-primary/10 font-medium text-foreground'
                )}
              >
                <StateTransition
                  identity={controller.activeJob?.id}
                  state={`${complete}:${current}`}
                  className='shrink-0'
                >
                  {marker}
                </StateTransition>
                <span>{phase.label}</span>
              </li>
            )
          })}
        </ol>
      </BuildRunPanel>
      {controller.activeJob ? (
        <BuildLogs
          job={controller.activeJob}
          running={controller.isRunning}
        />
      ) : null}
    </aside>
  )
}
