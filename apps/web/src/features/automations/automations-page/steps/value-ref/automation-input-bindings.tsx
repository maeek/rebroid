import { actionInputBinding, actionInputBindingType } from '@rebroid/automation-core/command-registry'
import { SelectField } from '../../actions/shared/action-fields'
import type { AutomationStepReferenceOption } from './automation-value-ref-constants'
import type { AutomationCommand } from '@/shared/contracts/automation'

const referenceId = (stepId: string, outputKey: string) => JSON.stringify([stepId, outputKey])

export function AutomationInputBindings({
  command,
  input,
  stepOptions,
  patchInput
}: {
  command: AutomationCommand
  input: Record<string, unknown>
  stepOptions: AutomationStepReferenceOption[]
  patchInput: (patch: Record<string, unknown>) => void
}) {
  const properties = command.inputSchema.properties
  if (!properties || typeof properties !== 'object') return null
  const fields = command.editor.inputFieldOrder.flatMap(key => {
    const type = actionInputBindingType(command.uses, key, (properties as Record<string, unknown>)[key])
    if (!type) return []
    const current = actionInputBinding(input[key])
    const choices = stepOptions.flatMap(step =>
      step.outputs
        .filter(output => output.type === type)
        .map(output => ({
          value: referenceId(step.id, output.key),
          label: `${step.id} · ${output.label}`,
          reference: { source: 'stepOutput', stepId: step.id, outputKey: output.key }
        }))
    )
    if (!current && !choices.length) return []
    const selected = current ? referenceId(current.stepId, current.outputKey) : 'literal'
    const unavailable = current && !choices.some(choice => choice.value === selected)
    return [
      <SelectField
        key={key}
        label={`Source for ${key}`}
        value={selected}
        options={[
          { value: 'literal', label: 'Literal value' },
          ...choices,
          ...(unavailable ? [{ value: selected, label: `${current.stepId} · ${current.outputKey} (unavailable)` }] : [])
        ]}
        onChange={value => {
          if (value === 'literal') {
            patchInput({ [key]: command.editor.inputDefaults[key] })
            return
          }
          const choice = choices.find(item => item.value === value)
          if (choice) patchInput({ [key]: { $ref: choice.reference } })
        }}
      />
    ]
  })

  if (!fields.length) return null
  return <div className='grid gap-4'>{fields}</div>
}
