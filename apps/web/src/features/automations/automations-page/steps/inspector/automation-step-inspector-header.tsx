'use client'

import { useContext } from 'react'
import { IconFileCode, IconRoute, IconX } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { FormLoadingContext } from '@/components/ui/form-loading-boundary'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
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
  const loading = useContext(FormLoadingContext)
  return (
    <div className='flex min-w-0 items-start justify-between gap-3 px-6 pt-6 pb-4 max-sm:px-4 max-sm:pt-4'>
      <div className='grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-3'>
        <span
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-control bg-background/70',
            loading ? 'text-foreground-muted' : 'text-primary'
          )}
        >
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
          <div className='flex min-w-0 flex-wrap items-center gap-2'>
            <h3 className='break-words text-base font-medium'>
              {loading ? (
                <Skeleton
                  as='span'
                  className='block h-6 w-40 max-w-full'
                />
              ) : (
                stepTitle(step, command)
              )}
            </h3>
            <span className='text-xs text-foreground-muted'>{loading ? null : stepKindLabel(step)}</span>
          </div>
          <p className='truncate text-xs text-foreground-muted'>
            {loading ? (
              <Skeleton
                as='span'
                className='block h-3 w-48 max-w-full'
              />
            ) : (
              stepSummary(step)
            )}
          </p>
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
