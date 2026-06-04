'use client'

import { useState } from 'react'
import { IconDotsVertical, IconFileCode, IconSettings } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Label } from '@/components/ui/label'
import { Section } from '@/components/ui/section'
import {
  getActionUiStateFromInput,
  getAutomationActionDefinition,
  getDefaultActionInput,
  normalizeActionInput
} from './actions/action-registry'
import { AutomationActionPicker } from './automation-action-picker'
import { AutomationCommandIcon } from './automation-command-catalog'
import { AutomationRawInputDialog, AutomationStepSettingsDialog } from './automation-step-dialogs'
import { parseStepInput, updateStepInput } from './automation-step-utils'
import type { AutomationStepForm } from './builder-utils'
import type { AutomationCommand } from '@/server/orchestrator/automations/types'

export function AutomationStepEditor({
  step,
  commands,
  onChange,
  boxed = true
}: {
  step: AutomationStepForm | null
  commands: AutomationCommand[]
  onChange: (step: AutomationStepForm) => void
  boxed?: boolean
}) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [rawOpen, setRawOpen] = useState(false)

  if (!step) {
    return (
      <Section
        boxed={boxed}
        contentClassName='text-sm text-secondary-foreground'
      >
        Select a step to edit.
      </Section>
    )
  }

  const command = commands.find(item => item.uses === step.uses)
  const definition = getAutomationActionDefinition(step.uses, command)
  const input = parseStepInput(step)

  const updateAction = (uses: string) => {
    const nextInput = getDefaultActionInput(uses)

    onChange({
      ...step,
      uses,
      withJson: JSON.stringify(nextInput, null, 2),
      uiState: getActionUiStateFromInput(uses, nextInput)
    })
  }

  const replaceInput = (nextInput: Record<string, unknown>) => {
    const normalizedInput = normalizeActionInput(step.uses, nextInput)
    onChange({
      ...step,
      withJson: JSON.stringify(normalizedInput, null, 2),
      uiState: { ...(step.uiState ?? {}), ...getActionUiStateFromInput(step.uses, normalizedInput) }
    })
  }

  const applyRawInput = (json: string) => {
    const parsed = JSON.parse(json || '{}') as unknown
    replaceInput(
      parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {}
    )
  }

  const patchUiState = (patch: Record<string, unknown>) => {
    onChange({
      ...step,
      uiState: { ...(step.uiState ?? {}), ...patch }
    })
  }

  return (
    <>
      <Section
        boxed={boxed}
        contentClassName='gap-5'
        className={boxed ? undefined : 'bg-transparent p-0 shadow-none'}
      >
        <div className='flex items-start justify-between gap-3'>
          <div className='flex min-w-0 items-center gap-3'>
            <span className='flex size-10 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary'>
              <AutomationCommandIcon
                uses={step.uses}
                className='size-5'
              />
            </span>
            <div className='min-w-0'>
              <h3 className='truncate font-medium'>{command?.label ?? definition.label ?? step.uses}</h3>
              <p className='truncate text-xs text-secondary-foreground'>
                {command?.description ?? definition.description ?? step.uses}
              </p>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant='ghost'
                size='icon'
                aria-label='Step menu'
              >
                <IconDotsVertical className='size-4' />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end'>
              <DropdownMenuItem onSelect={() => setSettingsOpen(true)}>
                <IconSettings className='size-4' />
                Step settings
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setRawOpen(true)}>
                <IconFileCode className='size-4' />
                Edit raw input
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className='grid gap-2'>
          <Label>Action</Label>
          <AutomationActionPicker
            commands={commands}
            value={step.uses}
            onChange={updateAction}
          />
        </div>

        {definition.renderEditor({
          command,
          input,
          uiState: step.uiState ?? {},
          patchInput: patch => onChange(updateStepInput(step, patch)),
          replaceInput,
          patchUiState
        })}
      </Section>

      <AutomationStepSettingsDialog
        open={settingsOpen}
        step={step}
        onOpenChange={setSettingsOpen}
        onApply={stepId => onChange({ ...step, id: stepId })}
      />
      <AutomationRawInputDialog
        open={rawOpen}
        step={step}
        onOpenChange={setRawOpen}
        onApply={json => applyRawInput(json)}
      />
    </>
  )
}
