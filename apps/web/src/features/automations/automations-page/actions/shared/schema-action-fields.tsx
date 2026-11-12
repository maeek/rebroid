import { hasActionInputBinding } from '@rebroid/automation-core/command-registry'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { NoInputState, SelectField, TextField } from './action-fields'
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
        if (hasActionInputBinding(input[key])) return null
        const schema = record(properties[key])
        const value = input[key] ?? command.editor.inputDefaults[key]
        const label = typeof schema.title === 'string' ? schema.title : key
        const setValue = (next: unknown) => patchInput({ [key]: next })
        if (Array.isArray(schema.enum) && schema.enum.every(option => typeof option === 'string')) {
          return (
            <SelectField
              key={key}
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
              label={label}
              value={typeof value === 'string' ? value : ''}
              onChange={setValue}
            />
          )
        }
        if (schema.type === 'number' || schema.type === 'integer') {
          return (
            <FormField
              key={key}
              label={label}
              layout='vertical'
            >
              <Input
                type='number'
                min={typeof schema.minimum === 'number' ? schema.minimum : undefined}
                max={typeof schema.maximum === 'number' ? schema.maximum : undefined}
                step={schema.type === 'integer' ? 1 : 'any'}
                value={typeof value === 'number' ? value : ''}
                onChange={event => setValue(event.target.value === '' ? undefined : event.target.valueAsNumber)}
              />
            </FormField>
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
