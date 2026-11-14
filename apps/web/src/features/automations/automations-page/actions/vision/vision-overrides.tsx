import { TextField } from '../shared/action-fields'
import { stringInputValue } from '../shared/input-values'
import type { AutomationActionEditorProps } from '../automation-action-definition'

export function VisionOverrides({ input, patchInput }: Pick<AutomationActionEditorProps, 'input' | 'patchInput'>) {
  return (
    <div className='grid gap-3 sm:grid-cols-2'>
      {(
        [
          ['visionProviderId', 'Vision provider ID'],
          ['visionModelId', 'Vision model ID']
        ] as const
      ).map(([field, label]) => (
        <TextField
          key={field}
          field={field}
          label={label}
          placeholder='Use default…'
          value={stringInputValue(input, field)}
          onChange={value => patchInput({ [field]: value.trim() ? value : undefined })}
        />
      ))}
    </div>
  )
}
