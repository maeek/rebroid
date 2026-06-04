'use client'

import { Label } from '@/components/ui/label'
import { Section } from '@/components/ui/section'
import {
  getActionUiStateFromInput,
  getAutomationActionDefinition,
  getDefaultActionInput,
  normalizeActionInput
} from './actions/action-registry'
import { AutomationActionPicker } from './automation-action-picker'
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

    </>
  )
}
