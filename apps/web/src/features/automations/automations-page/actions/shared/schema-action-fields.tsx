import { NoInputState, NumberField, SelectField, TextField } from './action-fields'
import type { AutomationActionEditorProps } from '../automation-action-definition'

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}

export function SchemaActionFields({ command, input, patchInput }: AutomationActionEditorProps) {
  if (!command) return <NoInputState message='Use Edit YAML from the step menu.' />
  const properties = record(command.inputSchema.properties)
  const fields = command.editor.inputFieldOrder.filter(key => Object.hasOwn(properties, key))
  if (fields.length === 0) return <NoInputState />

  return (
    <div className='grid gap-4'>
      {fields.map(key => {
        const schema = record(properties[key])
        const value = input[key] ?? command.editor.inputDefaults[key]
        const label = typeof schema.title === 'string' ? schema.title : key
        const setValue = (next: unknown) => patchInput({ [key]: next })
        if (Array.isArray(schema.enum) && schema.enum.every(option => typeof option === 'string')) {
          return (
            <SelectField
              key={key}
              field={key}
              label={label}
              value={typeof value === 'string' ? value : ''}
              options={schema.enum}
              onChange={setValue}
            />
          )
        }
        if (schema.type === 'boolean') {
          return (
            <SelectField
              key={key}
              field={key}
              label={label}
              value={typeof value === 'boolean' ? String(value) : ''}
              options={[
                { value: 'true', label: 'Yes' },
                { value: 'false', label: 'No' }
              ]}
              onChange={next => setValue(next === 'true')}
            />
          )
        }
        if (schema.type === 'string') {
          return (
            <TextField
              key={key}
              field={key}
              label={label}
              value={typeof value === 'string' ? value : ''}
              onChange={setValue}
            />
          )
        }
        if (schema.type === 'number' || schema.type === 'integer') {
          return (
            <NumberField
              key={key}
              field={key}
              label={label}
              value={typeof value === 'number' ? value : undefined}
              onChange={setValue}
            />
          )
        }
        return (
          <NoInputState
            key={key}
            message={`Edit ${label} in YAML.`}
          />
        )
      })}
    </div>
  )
}
