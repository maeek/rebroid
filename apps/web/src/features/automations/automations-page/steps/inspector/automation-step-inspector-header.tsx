'use client'

import { IconFileCode, IconRoute, IconX } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { AutomationCommandIcon } from '../catalog/automation-command-catalog'
import { stepKindLabel, stepSummary, stepTitle } from '../shared/automation-step-utils'
import type { AutomationStepForm } from '../../editor/builder-utils'
import type { AutomationCommand } from '@/shared/contracts/automation'

export function AutomationStepInspectorHeader({
  step,
  command,
  yamlMode,
  onToggleYaml,
  onClose
}: {
  step: AutomationStepForm
  command?: AutomationCommand
  yamlMode: boolean
  onToggleYaml?: () => void
  onClose?: () => void
}) {
  return (
    <div className='flex min-w-0 items-start justify-between gap-3 border-b border-surface-border/60 px-4 py-4'>
      <div className='grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-3'>
        <span className='flex size-9 shrink-0 items-center justify-center rounded-control bg-background/70 text-primary'>
          {step.kind === 'action' ? (
            <AutomationCommandIcon
              uses={step.uses}
              className='size-5'
            />
          ) : (
            <IconRoute className='size-5' />
          )}
        </span>
        <div className='min-w-0'>
          <div className='flex min-w-0 items-center gap-2'>
            <h3 className='truncate text-base font-medium'>{stepTitle(step, command)}</h3>
            <span className='rounded-control border border-surface-border/60 px-1.5 py-0.5 text-xs uppercase tracking-normal text-foreground-muted'>
              {stepKindLabel(step)}
            </span>
          </div>
          <p className='truncate text-xs text-foreground-muted'>{stepSummary(step)}</p>
        </div>
      </div>
      <div className='flex shrink-0 items-center gap-1'>
        {step.kind === 'action' && onToggleYaml ? (
          <Button
            type='button'
            variant='ghost'
            size='icon-md'
            aria-label={yamlMode ? 'Edit visually' : 'Edit YAML'}
            onClick={onToggleYaml}
          >
            <IconFileCode className='size-4' />
          </Button>
        ) : null}
        {onClose ? (
          <Button
            type='button'
            variant='ghost'
            size='icon-md'
            aria-label='Close inspector'
            onClick={onClose}
          >
            <IconX className='size-4' />
          </Button>
        ) : null}
      </div>
    </div>
  )
}
