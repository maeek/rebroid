import { useEffect, useRef, useState } from 'react'
import { actionInputBinding } from '@rebroid/automation-core/command-registry'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { TextareaField, TextField } from '../shared/action-fields'
import { AdvancedActionFields } from '../shared/advanced-action-fields'
import { normalizeStringInput, stringInputValue } from '../shared/input-values'
import type { AutomationActionDefinition } from '../automation-action-definition'

export const pushFileAction: AutomationActionDefinition = {
  uses: 'android.pushFile',
  category: 'Files',
  iconKey: 'file-import',
  defaultInput: () => ({ path: '', contentBase64: '' }),
  normalizeInput: input => ({
    ...normalizeStringInput(input, 'path'),
    ...normalizeStringInput(input, 'contentBase64')
  }),
  summary: input => stringInputValue(input, 'path') || 'path:',
  renderEditor: props => <PushFileFields {...props} />
}

function PushFileFields({ input, patchInput }: Parameters<AutomationActionDefinition['renderEditor']>[0]) {
  const [file, setFile] = useState<{ name: string; size: number; content: string }>()
  const [error, setError] = useState<string>()
  const activeReader = useRef<FileReader | null>(null)
  const applyInput = useRef(patchInput)
  useEffect(() => {
    applyInput.current = patchInput
  }, [patchInput])
  useEffect(() => () => activeReader.current?.abort(), [])
  const linked = actionInputBinding(input.contentBase64)
  const contents = stringInputValue(input, 'contentBase64')
  return (
    <div className='grid gap-3'>
      <TextField
        field='path'
        label='Destination path'
        placeholder='/sdcard/Download/example.txt…'
        error={
          typeof input.path === 'string' && input.path && !input.path.startsWith('/')
            ? 'Enter an absolute Android path beginning with /.'
            : undefined
        }
        value={stringInputValue(input, 'path')}
        onChange={value => patchInput({ path: value })}
      />
      <FormField
        label='Choose local file'
        description='The file contents are embedded in the workflow.'
        error={error}
        layout='vertical'
      >
        <Input
          type='file'
          onChange={event => {
            const selected = event.currentTarget.files?.[0]
            if (!selected) return
            event.currentTarget.value = ''
            activeReader.current?.abort()
            if (selected.size > 2_000_000) {
              setError('Choose a file no larger than 2 MB.')
              return
            }
            setError(undefined)
            const reader = new FileReader()
            activeReader.current = reader
            reader.onerror = () => setError('Could not read this file. Choose it again.')
            reader.onload = () => {
              if (typeof reader.result !== 'string') return
              const content = reader.result.slice(reader.result.indexOf(',') + 1)
              setFile({ name: selected.name, size: selected.size, content })
              applyInput.current({ contentBase64: content })
            }
            reader.readAsDataURL(selected)
          }}
        />
      </FormField>
      {file && contents === file.content ? (
        <p className='break-words text-sm text-foreground-muted'>
          {file.name} · {new Intl.NumberFormat().format(file.size)} bytes
        </p>
      ) : null}
      <AdvancedActionFields
        label='Base64 and step outputs'
        open={Boolean(linked)}
        summary={linked ? 'Uses step output' : contents ? 'Embedded content' : undefined}
      >
        <TextareaField
          field='contentBase64'
          label='File contents (base64)'
          description='Paste encoded content or use the File content output of an earlier step.'
          className='font-mono'
          value={contents}
          onChange={value => patchInput({ contentBase64: value })}
        />
      </AdvancedActionFields>
    </div>
  )
}
