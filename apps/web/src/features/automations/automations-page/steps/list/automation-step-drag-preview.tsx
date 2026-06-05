import { IconRoute } from '@tabler/icons-react'
import { AutomationCommandIcon } from '../catalog/automation-command-catalog'
import { stepSummary, stepTitle } from '../shared/automation-step-utils'
import type { AutomationStepForm } from '../../editor/builder-utils'
import type { AutomationCommand } from '@/server/orchestrator/automations/types'

export function AutomationStepDragPreview({
  step,
  command
}: {
  step: AutomationStepForm
  command?: AutomationCommand
}) {
  return (
    <div className='grid h-16 w-[min(32rem,calc(100vw-3rem))] grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-md border border-primary/40 bg-popover px-3 py-2 text-foreground shadow-xl shadow-black/30'>
      <span className='flex size-9 shrink-0 items-center justify-center rounded-md bg-background/70 text-primary'>
        {step.kind === 'action' ? (
          <AutomationCommandIcon
            uses={step.uses}
            className='size-5'
          />
        ) : (
          <IconRoute className='size-5' />
        )}
      </span>
      <span className='min-w-0'>
        <span className='block truncate text-sm font-medium'>{stepTitle(step, command)}</span>
        <span className='block truncate text-xs text-secondary-foreground'>{stepSummary(step)}</span>
      </span>
    </div>
  )
}
