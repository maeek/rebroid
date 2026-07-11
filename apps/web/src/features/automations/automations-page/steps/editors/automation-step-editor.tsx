'use client'

import { Label } from '@/components/ui/label'
import { Section } from '@/components/ui/section'
import {
  getActionUiStateFromInput,
  getAutomationActionDefinition,
  getDefaultActionInput,
  normalizeActionInput
} from '../../actions/action-registry'
import { AutomationActionPicker } from '../catalog/automation-action-picker'
import { parseStepInput } from '../shared/automation-step-utils'
import type { AutomationActionStepForm } from '../../editor/builder-utils'
import type { AutomationCommand } from '@/server/orchestrator/automations/types'

export function AutomationStepEditor({
  step,
  commands,
  onChange,
  surface = 'panel'
}: {
  step: AutomationActionStepForm | null
  commands: AutomationCommand[]
  onChange: (step: AutomationActionStepForm) => void
  surface?: 'plain' | 'band' | 'panel'
}) {
  if (!step) {
    return (
      <Section
        surface={surface}
        contentClassName='text-sm text-foreground-muted'
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
        surface={surface}
        contentClassName='gap-5'
        className={surface === 'plain' ? 'bg-transparent p-0 shadow-none' : undefined}
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
          commands,
          input,
          uiState: step.uiState ?? {},
          patchInput: patch =>
            onChange({
              ...step,
              withJson: JSON.stringify({ ...parseStepInput(step), ...patch }, null, 2)
            }),
          replaceInput,
          patchUiState
        })}
      </Section>
    </>
  )
}
