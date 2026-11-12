'use client'

import { hasActionInputBinding } from '@rebroid/automation-core/command-registry'
import { FormField } from '@/components/ui/form-field'
import { Section } from '@/components/ui/section'
import {
  getActionUiStateFromInput,
  getAutomationActionDefinition,
  getDefaultActionInput,
  normalizeActionInput
} from '../../actions/action-registry'
import { SchemaActionFields } from '../../actions/shared/schema-action-fields'
import { AutomationActionPicker } from '../catalog/automation-action-picker'
import { parseStepInput } from '../shared/automation-step-utils'
import { AutomationInputBindings } from '../value-ref/automation-input-bindings'
import type { AutomationActionEditorProps } from '../../actions/automation-action-definition'
import type { AutomationActionStepForm } from '../../editor/builder-utils'
import type { AutomationStepReferenceOption } from '../value-ref/automation-value-ref-constants'
import type { AutomationCommand } from '@/shared/contracts/automation'

export function AutomationStepEditor({
  step,
  commands,
  stepOptions,
  onChange,
  surface = 'panel'
}: {
  step: AutomationActionStepForm | null
  commands: AutomationCommand[]
  stepOptions: AutomationStepReferenceOption[]
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
    const nextInput = getDefaultActionInput(
      uses,
      commands.find(item => item.uses === uses)
    )

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

  const patchInput = (patch: Record<string, unknown>) =>
    onChange({ ...step, withJson: JSON.stringify({ ...input, ...patch }, null, 2) })
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
    <>
      <Section
        surface={surface}
        contentClassName='gap-5'
        className={surface === 'plain' ? 'bg-transparent p-0 shadow-none' : undefined}
      >
        <FormField
          label='Action'
          description='Choose the action this step performs.'
          layout='vertical'
        >
          <AutomationActionPicker
            commands={commands}
            value={step.uses}
            onChange={updateAction}
          />
        </FormField>

        {step.uses !== 'ai.run' && Object.values(input).some(hasActionInputBinding) ? (
          <SchemaActionFields {...editorProps} />
        ) : (
          definition.renderEditor(editorProps)
        )}
        {command && (
          <AutomationInputBindings
            command={command}
            input={input}
            stepOptions={stepOptions}
            patchInput={patchInput}
          />
        )}
      </Section>
    </>
  )
}
