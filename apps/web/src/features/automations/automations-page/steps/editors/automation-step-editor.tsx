'use client'

import { Section } from '@/components/ui/section'
import {
  getActionUiStateFromInput,
  getAutomationActionDefinition,
  normalizeActionInput
} from '../../actions/action-registry'
import { parseStepInput } from '../shared/automation-step-utils'
import { AutomationInputContext } from '../value-ref/automation-input-bindings'
import type { AutomationActionEditorProps } from '../../actions/automation-action-definition'
import type { AutomationActionStepForm } from '../../editor/builder-utils'
import type { AutomationStepReferenceOption } from '../value-ref/automation-value-ref-constants'
import type { AutomationCommand } from '@/shared/contracts/automation'

export function AutomationStepEditor({
  step,
  commands,
  stepOptions,
  onChange
}: {
  step: AutomationActionStepForm
  commands: AutomationCommand[]
  stepOptions: AutomationStepReferenceOption[]
  onChange: (step: AutomationActionStepForm) => void
}) {
  const command = commands.find(item => item.uses === step.uses)
  const definition = getAutomationActionDefinition(step.uses, command)
  const input = parseStepInput(step)

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

  const patchInput = (patch: Record<string, unknown>, uiPatch?: Record<string, unknown>) =>
    onChange({
      ...step,
      withJson: JSON.stringify({ ...input, ...patch }, null, 2),
      ...(uiPatch ? { uiState: { ...step.uiState, ...uiPatch } } : {})
    })
  const editorProps: AutomationActionEditorProps = {
    command,
    commands,
    input,
    uiState: step.uiState ?? {},
    patchInput,
    replaceInput,
    patchUiState
  }

  return (
    <Section
      surface='plain'
      contentClassName='gap-5'
    >
      <AutomationInputContext.Provider
        key={`${step.clientKey}:${step.uses}`}
        value={{ command, input, stepOptions, patchInput }}
      >
        {definition.renderEditor(editorProps)}
      </AutomationInputContext.Provider>
    </Section>
  )
}
